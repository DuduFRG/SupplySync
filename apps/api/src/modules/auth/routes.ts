import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CodePurpose, PrismaClient } from '@prisma/client';
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_MINUTES,
  emailOnlySchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@supplysync/shared';
import { keyedHash, randomNumericCode, safeEqual } from '../../lib/crypto';
import { AppError, Errors } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { MailTemplates } from '../../services/mailer';

/** Mesma resposta para e-mail existente ou não: impede enumeração de usuários. */
const ACCEPTED = { message: 'Se o e-mail puder ser usado, você vai receber um código em instantes.' };
const INVALID_CREDENTIALS = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
const INVALID_CODE = () => new AppError(400, 'INVALID_CODE', 'Código inválido ou expirado');
const TOO_MANY = () => new AppError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos.');

const limit = (max: number, timeWindow: string) => ({ config: { rateLimit: { max, timeWindow } } });

export async function authRoutes(app: FastifyInstance) {
  const { prisma, passwords, sessions, captcha, mailer, throttle, config } = app.services;

  const codeHash = (purpose: CodePurpose, userId: string, code: string) =>
    keyedHash(config.TOKEN_HASH_SECRET, `${purpose}:${userId}:${code}`);

  async function assertHuman(request: FastifyRequest, token: string | undefined) {
    if (!(await captcha.verify(token, request.ip))) throw Errors.captcha();
  }

  async function issueCode(userId: string, purpose: CodePurpose): Promise<string> {
    const code = randomNumericCode(6);
    await prisma.$transaction([
      // Um código novo invalida os anteriores do mesmo tipo.
      prisma.emailCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
      prisma.emailCode.create({
        data: {
          userId,
          purpose,
          codeHash: codeHash(purpose, userId, code),
          expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    return code;
  }

  /** Confere um código com limite de tentativas e comparação em tempo constante. */
  async function consumeCode(db: PrismaClient, userId: string, purpose: CodePurpose, code: string): Promise<boolean> {
    const record = await db.emailCode.findFirst({
      where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return false;

    const updated = await db.emailCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    if (updated.attempts > EMAIL_CODE_MAX_ATTEMPTS) {
      await db.emailCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
      return false;
    }
    if (!safeEqual(record.codeHash, codeHash(purpose, userId, code))) return false;

    const { count } = await db.emailCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return count === 1;
  }

  // -------------------------------------------------------------------------
  app.post('/register', limit(10, '1 hour'), async (request, reply) => {
    const body = parse(registerSchema, request.body);
    await assertHuman(request, body.captchaToken);

    if (!(await throttle.hit(`register:${body.email}`, 3, 3600))) return reply.status(202).send(ACCEPTED);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    const passwordHash = await passwords.hash(body.password); // sempre calculado: tempo de resposta uniforme

    if (existing?.emailVerifiedAt && !existing.deletedAt) {
      await mailer.send({ to: body.email, ...MailTemplates.alreadyRegistered() });
      return reply.status(202).send(ACCEPTED);
    }

    // Conta nova, ou conta nunca confirmada (quem confirmar o e-mail fica com ela).
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, displayName: body.displayName } })
      : await prisma.user.create({ data: { email: body.email, passwordHash, displayName: body.displayName } });

    const code = await issueCode(user.id, 'VERIFY_EMAIL');
    await mailer.send({ to: body.email, ...MailTemplates.verifyEmail(body.displayName, code) });
    return reply.status(202).send(ACCEPTED);
  });

  // -------------------------------------------------------------------------
  app.post('/verify-email', limit(30, '15 minutes'), async (request) => {
    const body = parse(verifyEmailSchema, request.body);
    if (!(await throttle.hit(`verify:${body.email}`, 10, 900))) throw TOO_MANY();

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.deletedAt || user.emailVerifiedAt) throw INVALID_CODE();
    if (!(await consumeCode(prisma, user.id, 'VERIFY_EMAIL', body.code))) throw INVALID_CODE();

    const verified = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return sessions.issue(verified);
  });

  // -------------------------------------------------------------------------
  app.post('/resend-code', limit(10, '1 hour'), async (request, reply) => {
    const body = parse(emailOnlySchema, request.body);
    await assertHuman(request, body.captchaToken);
    if (!(await throttle.hit(`resend:${body.email}`, 3, 900))) return reply.status(202).send(ACCEPTED);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user && !user.deletedAt && !user.emailVerifiedAt) {
      const code = await issueCode(user.id, 'VERIFY_EMAIL');
      await mailer.send({ to: user.email, ...MailTemplates.verifyEmail(user.displayName, code) });
    }
    return reply.status(202).send(ACCEPTED);
  });

  // -------------------------------------------------------------------------
  app.post('/login', limit(30, '15 minutes'), async (request) => {
    const body = parse(loginSchema, request.body);
    await assertHuman(request, body.captchaToken);

    // Limite por conta: barra força bruta distribuída entre muitos IPs.
    const throttleKey = `login:${body.email}`;
    if (!(await throttle.hit(throttleKey, 10, 900))) throw TOO_MANY();

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.deletedAt) {
      await passwords.verifyAgainstDummy(body.password);
      throw INVALID_CREDENTIALS();
    }
    if (!(await passwords.verify(user.passwordHash, body.password))) throw INVALID_CREDENTIALS();

    if (!user.emailVerifiedAt) {
      // Só chega aqui quem sabe a senha: não há vazamento de existência da conta.
      const code = await issueCode(user.id, 'VERIFY_EMAIL');
      await mailer.send({ to: user.email, ...MailTemplates.verifyEmail(user.displayName, code) });
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Confirme seu e-mail. Enviamos um novo código.');
    }

    await throttle.reset(throttleKey);
    return sessions.issue(user);
  });

  // -------------------------------------------------------------------------
  app.post('/refresh', limit(60, '1 minute'), async (request) => {
    const body = parse(refreshSchema, request.body);
    return sessions.rotate(body.refreshToken);
  });

  app.post('/logout', limit(30, '1 minute'), async (request, reply) => {
    const body = parse(refreshSchema, request.body);
    await sessions.revoke(body.refreshToken);
    return reply.status(204).send();
  });

  // -------------------------------------------------------------------------
  app.post('/forgot-password', limit(10, '1 hour'), async (request, reply) => {
    const body = parse(emailOnlySchema, request.body);
    await assertHuman(request, body.captchaToken);
    if (!(await throttle.hit(`forgot:${body.email}`, 3, 3600))) return reply.status(202).send(ACCEPTED);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user && !user.deletedAt) {
      const code = await issueCode(user.id, 'RESET_PASSWORD');
      await mailer.send({ to: user.email, ...MailTemplates.resetPassword(code) });
    }
    return reply.status(202).send(ACCEPTED);
  });

  app.post('/reset-password', limit(20, '15 minutes'), async (request) => {
    const body = parse(resetPasswordSchema, request.body);
    if (!(await throttle.hit(`reset:${body.email}`, 10, 900))) throw TOO_MANY();

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.deletedAt) throw INVALID_CODE();
    if (!(await consumeCode(prisma, user.id, 'RESET_PASSWORD', body.code))) throw INVALID_CODE();

    const passwordHash = await passwords.hash(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      // Quem recebeu o código comprovou posse do e-mail.
      data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    await sessions.revokeAllForUser(user.id);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return sessions.issue(fresh);
  });
}
