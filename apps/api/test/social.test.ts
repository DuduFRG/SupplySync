import { createHash, randomBytes } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet, type CryptoKey } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { SocialVerifier } from '../src/services/social';
import { auth, createTestContext, lastCode, resetDatabase, signUp, type TestContext } from './helpers';

/**
 * Login com Google e Apple, sem rede: geramos chaves de teste e assinamos tokens
 * como o Google/Apple fariam. A API recebe as nossas chaves públicas no lugar das deles.
 */
const GOOGLE_AUD = 'test-web-client.apps.googleusercontent.com';
const APPLE_AUD = 'app.supplysync.mobile';

let ctx: TestContext;
let googleKey: CryptoKey;
let appleKey: CryptoKey;
let strangerKey: CryptoKey;

async function token(
  provider: 'google' | 'apple',
  claims: Record<string, unknown>,
  opts: { key?: CryptoKey; aud?: string; exp?: string | number } = {},
) {
  const iss = provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com';
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: provider })
    .setIssuer(iss)
    .setAudience(opts.aud ?? (provider === 'google' ? GOOGLE_AUD : APPLE_AUD))
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m')
    .sign(opts.key ?? (provider === 'google' ? googleKey : appleKey));
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const newNonce = () => randomBytes(24).toString('base64url');

async function social(body: Record<string, unknown>) {
  return ctx.app.inject({ method: 'POST', url: '/v1/auth/social', payload: body });
}

beforeAll(async () => {
  const g = await generateKeyPair('RS256');
  const a = await generateKeyPair('RS256');
  const s = await generateKeyPair('RS256');
  googleKey = g.privateKey;
  appleKey = a.privateKey;
  strangerKey = s.privateKey;
  const jwks: Record<string, JSONWebKeySet> = {
    'https://www.googleapis.com/oauth2/v3/certs': { keys: [{ ...(await exportJWK(g.publicKey)), kid: 'google', alg: 'RS256', use: 'sig' }] },
    'https://appleid.apple.com/auth/keys': { keys: [{ ...(await exportJWK(a.publicKey)), kid: 'apple', alg: 'RS256', use: 'sig' }] },
  };
  const verifier = new SocialVerifier(
    { GOOGLE_CLIENT_IDS: [GOOGLE_AUD], APPLE_CLIENT_IDS: [APPLE_AUD] },
    async (url) => jwks[url]!,
  );
  ctx = await createTestContext({}, { social: verifier });
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.mailer.outbox.length = 0;
});
afterAll(async () => {
  await ctx.app.close();
});

describe('login com Google', () => {
  it('cria a conta na primeira vez, envia boas-vindas e entra na mesma conta depois', async () => {
    const claims = { sub: 'g-123', email: 'Bia@Gmail.com', email_verified: true, name: 'Bia Souza' };
    const first = await social({ provider: 'google', idToken: await token('google', claims) });
    expect(first.statusCode).toBe(200);
    expect(first.json().isNewUser).toBe(true);
    expect(ctx.mailer.outbox.map((m) => m.subject)).toEqual(['Sua conta no SupplySync foi criada']);

    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(first.json().accessToken) });
    expect(me.json().user).toMatchObject({ email: 'bia@gmail.com', displayName: 'Bia Souza', hasPassword: false, providers: ['google'] });

    const again = await social({ provider: 'google', idToken: await token('google', claims) });
    expect(again.statusCode).toBe(200);
    expect(again.json().isNewUser).toBeUndefined();
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('recusa token falso, vencido, de outro app ou com e-mail não confirmado', async () => {
    const claims = { sub: 'g-1', email: 'x@gmail.com', email_verified: true };
    const forged = await social({ provider: 'google', idToken: await token('google', claims, { key: strangerKey }) });
    const expired = await social({ provider: 'google', idToken: await token('google', claims, { exp: Math.floor(Date.now() / 1000) - 120 }) });
    const otherApp = await social({ provider: 'google', idToken: await token('google', claims, { aud: 'outro-app' }) });
    for (const r of [forged, expired, otherApp]) expect(r.statusCode).toBe(401);

    const unverified = await social({ provider: 'google', idToken: await token('google', { ...claims, email_verified: false }) });
    expect(unverified.statusCode).toBe(400);
    expect(await ctx.prisma.user.count()).toBe(0);
  });

  it('liga o Google a uma conta existente com o mesmo e-mail, sem perder a senha', async () => {
    const user = await signUp(ctx, 'Caio');
    const r = await social({ provider: 'google', idToken: await token('google', { sub: 'g-caio', email: user.email, email_verified: true }) });
    expect(r.statusCode).toBe(200);
    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(r.json().accessToken) });
    expect(me.json().user).toMatchObject({ id: user.userId, hasPassword: true, providers: ['google'] });

    const login = await ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: user.email, password: user.password } });
    expect(login.statusCode).toBe(200);
  });

  it('impede o "sequestro prévio": cadastro não confirmado com o e-mail de outra pessoa perde a senha', async () => {
    const victim = 'vitima@gmail.com';
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: victim, password: 'senha do atacante 1', displayName: 'Atacante' },
    });
    const r = await social({ provider: 'google', idToken: await token('google', { sub: 'g-vitima', email: victim, email_verified: true }) });
    expect(r.statusCode).toBe(200);

    const attacker = await ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: victim, password: 'senha do atacante 1' } });
    expect(attacker.statusCode).toBe(401);
  });
});

describe('login com Apple', () => {
  it('exige o nonce correto (proteção contra reaproveitamento do token)', async () => {
    const raw = newNonce();
    const claims = { sub: 'a-1', email: 'abc@privaterelay.appleid.com', email_verified: 'true', nonce: sha256(raw) };
    const idToken = await token('apple', claims);

    expect((await social({ provider: 'apple', idToken })).statusCode).toBe(401);
    expect((await social({ provider: 'apple', idToken, nonce: newNonce() })).statusCode).toBe(401);

    const ok = await social({ provider: 'apple', idToken, nonce: raw, displayName: 'Dani' });
    expect(ok.statusCode).toBe(200);
    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(ok.json().accessToken) });
    expect(me.json().user).toMatchObject({ displayName: 'Dani', providers: ['apple'] });
  });
});

describe('exclusão de conta criada com Google', () => {
  it('pede para entrar de novo com o mesmo Google e libera o login para uma conta futura', async () => {
    const claims = { sub: 'g-del', email: 'del@gmail.com', email_verified: true, name: 'Del' };
    const created = await social({ provider: 'google', idToken: await token('google', claims) });
    const headers = auth(created.json().accessToken);

    const wrong = await ctx.app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers,
      payload: { provider: 'google', idToken: await token('google', { ...claims, sub: 'g-outra-pessoa' }) },
    });
    expect(wrong.statusCode).toBe(401);

    const del = await ctx.app.inject({ method: 'DELETE', url: '/v1/me', headers, payload: { provider: 'google', idToken: await token('google', claims) } });
    expect(del.statusCode).toBe(204);

    const fresh = await social({ provider: 'google', idToken: await token('google', claims) });
    expect(fresh.json().isNewUser).toBe(true);
  });
});

describe('e-mail de boas-vindas no cadastro com senha', () => {
  it('é enviado depois que o e-mail é confirmado', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'nova@exemplo.com', password: 'casa verde 2026', displayName: 'Nova' },
    });
    expect(ctx.mailer.outbox.some((m) => m.subject.includes('foi criada'))).toBe(false);
    const code = lastCode(ctx.mailer, 'nova@exemplo.com');
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { email: 'nova@exemplo.com', code } });
    await new Promise((r) => setTimeout(r, 20));
    expect(ctx.mailer.outbox.at(-1)?.subject).toBe('Sua conta no SupplySync foi criada');
  });
});

describe('configuração', () => {
  it('login social desligado quando não há IDs configurados', async () => {
    const off = await createTestContext();
    try {
      const r = await off.app.inject({
        method: 'POST',
        url: '/v1/auth/social',
        payload: { provider: 'google', idToken: await token('google', { sub: 'x' }) },
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error.code).toBe('SOCIAL_LOGIN_UNAVAILABLE');
    } finally {
      await off.app.close();
    }
  });

  it('produção não aceita o Expo Go como destinatário da Apple', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@db/x?sslmode=require',
        JWT_ACCESS_SECRET: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7',
        TOKEN_HASH_SECRET: 'b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7',
        PASSWORD_PEPPER: 'c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7',
        CAPTCHA_PROVIDER: 'turnstile',
        TURNSTILE_SECRET_KEY: 'x',
        MAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        APPLE_CLIENT_IDS: 'app.supplysync.mobile,host.exp.Exponent',
      }),
    ).toThrow(/host.exp.Exponent/);
  });
});
