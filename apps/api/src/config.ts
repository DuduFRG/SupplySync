/**
 * Configuração carregada exclusivamente de variáveis de ambiente e validada no boot.
 * Se algo estiver ausente ou inseguro, o processo não sobe (fail closed).
 */
import { z } from 'zod';

const secret = (name: string) =>
  z
    .string({ message: `${name} é obrigatório` })
    .min(32, `${name} precisa de ao menos 32 caracteres`)
    .refine((v) => new Set(v).size >= 10, `${name} tem entropia baixa demais`);

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const csvList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().regex(/^[\w.-]{3,200}$/, 'Valor inválido na lista')));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL precisa ser PostgreSQL'),

    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    TOKEN_HASH_SECRET: secret('TOKEN_HASH_SECRET'),
    PASSWORD_PEPPER: secret('PASSWORD_PEPPER'),

    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    CORS_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(
        z.array(
          z
            .string()
            .refine(
              (v) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v) || /^http:\/\/localhost(:\d+)?$/.test(v),
              'Origens CORS precisam ser https://dominio (ou http://localhost em dev)',
            ),
        ),
      ),

    REDIS_URL: optionalString,

    CAPTCHA_PROVIDER: z.enum(['turnstile', 'none']).default('none'),
    TURNSTILE_SECRET_KEY: optionalString,

    // smtp: gratuito com Gmail (senha de app, ~500 e-mails/dia) ou Brevo (300/dia), sem domínio próprio.
    MAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
    RESEND_API_KEY: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: z.string().default('SupplySync <no-reply@supplysync.app>'),

    // Login social. Listas separadas por vírgula; vazio desliga o provedor.
    // Google: IDs de cliente OAuth (Web, iOS e Android) do Google Cloud.
    GOOGLE_CLIENT_IDS: csvList,
    // Apple: bundle ID do app. "host.exp.Exponent" (Expo Go) só é aceito fora de produção.
    APPLE_CLIENT_IDS: csvList,

    STORAGE_DIR: z.string().default('./storage'),
    EXPO_ACCESS_TOKEN: optionalString,
  })
  .superRefine((env, ctx) => {
    const secrets = [env.JWT_ACCESS_SECRET, env.TOKEN_HASH_SECRET, env.PASSWORD_PEPPER];
    if (new Set(secrets).size !== secrets.length) {
      ctx.addIssue({ code: 'custom', message: 'Os segredos precisam ser diferentes entre si', path: ['JWT_ACCESS_SECRET'] });
    }
    if (env.CAPTCHA_PROVIDER === 'turnstile' && !env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({ code: 'custom', message: 'TURNSTILE_SECRET_KEY é obrigatório', path: ['TURNSTILE_SECRET_KEY'] });
    }
    if (env.MAIL_PROVIDER === 'smtp' && !(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) {
      ctx.addIssue({ code: 'custom', message: 'SMTP_HOST, SMTP_USER e SMTP_PASS são obrigatórios', path: ['SMTP_HOST'] });
    }
    if (env.MAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY é obrigatório', path: ['RESEND_API_KEY'] });
    }
    if (env.NODE_ENV === 'production') {
      if (env.CAPTCHA_PROVIDER === 'none') {
        ctx.addIssue({ code: 'custom', message: 'Antibot é obrigatório em produção', path: ['CAPTCHA_PROVIDER'] });
      }
      if (env.APPLE_CLIENT_IDS.includes('host.exp.Exponent')) {
        // Qualquer projeto no Expo Go recebe tokens com esse destinatário: aceitar em produção
        // permitiria reaproveitar um login da Apple feito em outro app.
        ctx.addIssue({ code: 'custom', message: 'host.exp.Exponent não é permitido em produção', path: ['APPLE_CLIENT_IDS'] });
      }
      if (env.MAIL_PROVIDER === 'console') {
        ctx.addIssue({ code: 'custom', message: 'E-mail real é obrigatório em produção', path: ['MAIL_PROVIDER'] });
      }
      if (!/sslmode=(require|verify-full|verify-ca)/.test(env.DATABASE_URL)) {
        ctx.addIssue({ code: 'custom', message: 'Use sslmode=require no banco em produção', path: ['DATABASE_URL'] });
      }
    }
  });

export type Config = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Mostra apenas nomes de variáveis e motivos. Nunca os valores.
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${problems}`);
  }
  return parsed.data;
}
