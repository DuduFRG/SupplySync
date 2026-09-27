import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, createTestContext, lastCode, resetDatabase, signUp, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});
afterAll(async () => {
  await ctx.app.close();
});

describe('cadastro e anti-enumeração', () => {
  it('responde igual para e-mail novo e já cadastrado', async () => {
    const user = await signUp(ctx, 'Ana');
    const again = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: user.email, password: 'outra senha 2026', displayName: 'Invasor' },
    });
    const fresh = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'novo@exemplo.com', password: 'outra senha 2026', displayName: 'Novo' },
    });
    expect(again.statusCode).toBe(202);
    expect(fresh.statusCode).toBe(202);
    expect(again.body).toBe(fresh.body);

    // A senha de quem já tinha conta não muda.
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: user.email, password: user.password },
    });
    expect(login.statusCode).toBe(200);
  });

  it('senha nunca é salva em texto puro (argon2id)', async () => {
    const user = await signUp(ctx);
    const row = await ctx.prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordHash).not.toContain(user.password);
  });

  it('login: mesma mensagem para e-mail inexistente e senha errada', async () => {
    const user = await signUp(ctx);
    const wrong = await ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: user.email, password: 'errada 12345' } });
    const ghost = await ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'ghost@exemplo.com', password: 'errada 12345' } });
    expect(wrong.statusCode).toBe(401);
    expect(ghost.statusCode).toBe(401);
    expect(wrong.json()).toEqual(ghost.json());
  });

  it('código de e-mail: limite de tentativas invalida o código', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'lento@exemplo.com', password: 'senha forte 2026', displayName: 'Lento' },
    });
    const code = lastCode(ctx.mailer, 'lento@exemplo.com');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { email: 'lento@exemplo.com', code: wrong } });
      expect(r.statusCode).toBe(400);
    }
    const late = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { email: 'lento@exemplo.com', code } });
    expect(late.statusCode).toBe(400);
  });

  it('bloqueia força bruta por conta', async () => {
    const user = await signUp(ctx);
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const r = await ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: user.email, password: `errada ${i}0000` } });
      last = r.statusCode;
    }
    expect(last).toBe(429);
  });
});

describe('sessões', () => {
  it('refresh rotaciona e reuso derruba a família inteira', async () => {
    const user = await signUp(ctx);
    const first = await ctx.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: user.refreshToken } });
    expect(first.statusCode).toBe(200);
    const rotated = first.json() as { refreshToken: string };
    expect(rotated.refreshToken).not.toBe(user.refreshToken);

    // Reapresentar o token antigo (como faria um atacante) invalida também o novo.
    const replay = await ctx.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: user.refreshToken } });
    expect(replay.statusCode).toBe(401);
    const victim = await ctx.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: rotated.refreshToken } });
    expect(victim.statusCode).toBe(401);
  });

  it('rejeita JWT adulterado ou com algoritmo "none"', async () => {
    const user = await signUp(ctx);
    const [h, p] = user.accessToken.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: user.userId, tv: 0, iss: 'supplysync-api', aud: 'supplysync-app' })).toString('base64url');
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${forgedPayload}.`;
    const tampered = `${h}.${forgedPayload}.${p}`;
    for (const token of [none, tampered, 'lixo']) {
      const r = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(token) });
      expect(r.statusCode).toBe(401);
    }
  });

  it('redefinição de senha encerra sessões anteriores', async () => {
    const user = await signUp(ctx);
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/forgot-password', payload: { email: user.email } });
    const code = lastCode(ctx.mailer, user.email);
    const reset = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { email: user.email, code, newPassword: 'nova senha 2027' },
    });
    expect(reset.statusCode).toBe(200);
    const old = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(user.accessToken) });
    expect(old.statusCode).toBe(401);
  });
});
