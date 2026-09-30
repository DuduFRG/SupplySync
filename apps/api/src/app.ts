import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { PHOTO_MAX_BYTES } from '@supplysync/shared';
import type { Config } from './config';
import { AppError, Errors } from './lib/errors';
import { PasswordHasher } from './lib/password';
import { createCaptchaVerifier, type CaptchaVerifier } from './services/captcha';
import { createMailer, type Mailer } from './services/mailer';
import { createPushSender, type PushSender } from './services/push';
import { ACCESS_TOKEN_TTL_SECONDS, SessionService } from './services/sessions';
import { LocalPhotoStorage, type PhotoStorage } from './services/storage';
import { MemoryThrottle, RedisThrottle, ResilientThrottle, type Throttle } from './services/throttle';
import { authRoutes } from './modules/auth/routes';
import { meRoutes } from './modules/me/routes';
import { householdRoutes } from './modules/households/routes';
import { itemRoutes } from './modules/items/routes';
import { purchaseRoutes } from './modules/purchases/routes';
import { photoRoutes } from './modules/photos/routes';

export interface Services {
  config: Config;
  prisma: PrismaClient;
  passwords: PasswordHasher;
  sessions: SessionService;
  captcha: CaptchaVerifier;
  mailer: Mailer;
  push: PushSender;
  storage: PhotoStorage;
  throttle: Throttle;
}

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    /** Preenchido somente após autenticação bem-sucedida. */
    userId: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; tv: number };
    user: { sub: string; tv: number };
  }
}

export interface BuildOptions {
  config: Config;
  prisma?: PrismaClient;
  overrides?: Partial<Omit<Services, 'config' | 'prisma' | 'sessions'>>;
}

export async function buildApp({ config, prisma: injectedPrisma, overrides = {} }: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Nada sensível chega aos logs, mesmo que alguém adicione logging de body no futuro.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.newPassword',
          '*.refreshToken',
          '*.accessToken',
          '*.code',
          '*.captchaToken',
        ],
        censor: '[redacted]',
      },
    },
    // Confia apenas no número exato de proxies à frente (CDN/WAF, load balancer).
    // Sem isso, qualquer cliente forjaria X-Forwarded-For e burlaria o rate limit.
    trustProxy: config.TRUST_PROXY_HOPS > 0 ? (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS : false,
    bodyLimit: 64 * 1024,
    // Não aceitamos IDs de requisição do cliente; geramos os nossos.
    requestIdHeader: false,
    genReqId: () => crypto.randomUUID(),
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: 64 },
  });

  const prisma = injectedPrisma ?? new PrismaClient();
  const redis = config.REDIS_URL ? new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false }) : null;
  // Sem este listener o ioredis registra "Unhandled error event" a cada tentativa de reconexão.
  let redisDownLogged = false;
  redis?.on('error', (err) => {
    if (!redisDownLogged) app.log.error({ err }, 'redis: indisponível, usando limites locais');
    redisDownLogged = true;
  });
  redis?.on('ready', () => {
    if (redisDownLogged) app.log.info('redis: conexão restabelecida');
    redisDownLogged = false;
  });

  await app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET,
    // fast-jwt interpreta números como milissegundos: usamos string explícita.
    sign: { algorithm: 'HS256', expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`, iss: 'supplysync-api', aud: 'supplysync-app' },
    verify: { algorithms: ['HS256'], allowedIss: 'supplysync-api', allowedAud: 'supplysync-app' },
  });

  const services: Services = {
    config,
    prisma,
    passwords: overrides.passwords ?? new PasswordHasher(config.PASSWORD_PEPPER),
    sessions: new SessionService(prisma, config.TOKEN_HASH_SECRET, (payload) => app.jwt.sign(payload)),
    captcha: overrides.captcha ?? createCaptchaVerifier(config),
    mailer: overrides.mailer ?? createMailer(config, app.log),
    push: overrides.push ?? createPushSender(config, prisma, app.log),
    storage: overrides.storage ?? new LocalPhotoStorage(config.STORAGE_DIR),
    throttle:
      overrides.throttle ??
      (redis
        ? new ResilientThrottle(new RedisThrottle(redis), (err) => app.log.warn({ err }, 'throttle: fallback para memória'))
        : new MemoryThrottle()),
  };
  app.decorate('services', services);
  app.decorateRequest('userId', '');

  // --- Cabeçalhos de segurança -------------------------------------------------
  await app.register(helmet, {
    // A API só devolve JSON e imagens: nenhuma página deve ser renderizada a partir dela.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cache-Control', reply.getHeader('Cache-Control') ?? 'no-store');
  });

  // --- CORS: o app nativo não precisa. Só origens web explicitamente listadas. ---
  await app.register(cors, {
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  });

  // --- Rate limiting global por IP (rotas sensíveis têm limites próprios) -------
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Redis fora do ar não derruba a API: o limite por IP é pulado e a borda (Cloudflare)
    // continua limitando. Limites por conta seguem valendo via ResilientThrottle.
    ...(redis ? { redis, nameSpace: 'rl:', skipOnError: true } : {}),
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, ctx) =>
      new AppError(429, 'RATE_LIMITED', `Muitas tentativas. Aguarde ${Math.ceil(ctx.ttl / 1000)}s e tente de novo.`),
  });

  await app.register(multipart, {
    limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 0, parts: 1, headerPairs: 50 },
  });

  // --- Autenticação -------------------------------------------------------------
  app.decorate('authenticate', async (request) => {
    let payload: { sub: string; tv: number };
    try {
      payload = await request.jwtVerify();
    } catch {
      throw Errors.unauthorized();
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tokenVersion: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.tokenVersion !== payload.tv) throw Errors.unauthorized();

    // Limite por usuário: protege contra abuso mesmo com IPs rotativos.
    const allowed = await services.throttle.hit(`user:${user.id}`, 240, 60);
    if (!allowed) throw new AppError(429, 'RATE_LIMITED', 'Muitas ações em pouco tempo. Aguarde um instante.');

    request.userId = user.id;
  });

  // --- Tratamento de erros: nunca vazar detalhes internos -----------------------
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, 'app error');
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.publicMessage, ...(error.fields ? { fields: error.fields } : {}) },
      });
    }

    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      const messages: Record<number, string> = {
        400: 'Requisição inválida',
        401: 'Sessão expirada. Entre novamente.',
        404: 'Não encontrado',
        413: 'Arquivo ou requisição grande demais',
        415: 'Formato não suportado',
        429: 'Muitas tentativas. Aguarde um pouco.',
      };
      return reply.status(status).send({ error: { code: 'CLIENT_ERROR', message: messages[status] ?? 'Requisição inválida' } });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Algo deu errado do nosso lado. Tente novamente.' } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Não encontrado' } });
  });

  // --- Rotas --------------------------------------------------------------------
  app.get('/health', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => ({ ok: true }));

  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });

      // Tudo daqui para baixo exige sessão válida.
      await v1.register(async (authed) => {
        authed.addHook('preHandler', authed.authenticate);
        await authed.register(meRoutes, { prefix: '/me' });
        await authed.register(householdRoutes, { prefix: '/households' });
        await authed.register(itemRoutes, { prefix: '/households/:householdId/items' });
        await authed.register(purchaseRoutes, { prefix: '/households/:householdId' });
        await authed.register(photoRoutes, { prefix: '/households/:householdId/photos' });
      });
    },
    { prefix: '/v1' },
  );

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    redis?.disconnect();
  });

  return app;
}
