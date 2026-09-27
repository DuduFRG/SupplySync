import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { OutboundBlockedError, safeFetch } from '../src/lib/safe-fetch';
import { auth, createTestContext, resetDatabase, signUp, type TestContext } from './helpers';

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

async function householdWithItem(name: string) {
  const user = await signUp(ctx, name);
  const h = await ctx.app.inject({ method: 'POST', url: '/v1/households', headers: auth(user.accessToken), payload: { name: `Casa ${name}` } });
  const householdId = (h.json() as { id: string }).id;
  const i = await ctx.app.inject({
    method: 'POST',
    url: `/v1/households/${householdId}/items`,
    headers: auth(user.accessToken),
    payload: { name: 'Papel higiênico', category: 'HYGIENE', critical: true },
  });
  return { user, householdId, itemId: (i.json() as { id: string }).id };
}

describe('cabeçalhos e erros', () => {
  it('envia cabeçalhos de segurança e não expõe tecnologia', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.headers['strict-transport-security']).toBeDefined();
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('rotas inexistentes e administrativas devolvem 404 genérico', async () => {
    for (const url of ['/admin', '/v1/admin/users', '/.env', '/v1/../etc/passwd']) {
      const r = await ctx.app.inject({ method: 'GET', url });
      expect(r.statusCode).toBe(404);
      expect(r.body).not.toMatch(/stack|prisma|at \w+ \(/i);
    }
  });

  it('rejeita campos extras (mass assignment) sem ecoar valores', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'x@exemplo.com', password: 'senha forte 2026', displayName: 'Xavier', role: 'OWNER' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.fields).toEqual({ _: 'Campo não permitido' });
  });

  it('entrada maliciosa é tratada como texto, nunca SQL ou HTML', async () => {
    const { user, householdId } = await householdWithItem('Ana');
    const r = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/items`,
      headers: auth(user.accessToken),
      payload: { name: `'); DROP TABLE "User";--<svg onload=x>`, category: 'OTHER' },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().name).not.toMatch(/[<>]/);
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('corpo acima do limite é recusado', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(100_000) }),
    });
    expect(r.statusCode).toBe(413);
  });
});

describe('IDOR / BOLA', () => {
  it('ninguém acessa dados de outra casa, nem sabe que ela existe', async () => {
    const a = await householdWithItem('Ana');
    const b = await householdWithItem('Beto');
    const asB = auth(b.user.accessToken);

    const attempts = [
      { method: 'GET' as const, url: `/v1/households/${a.householdId}` },
      { method: 'GET' as const, url: `/v1/households/${a.householdId}/items` },
      { method: 'GET' as const, url: `/v1/households/${a.householdId}/balances` },
      { method: 'POST' as const, url: `/v1/households/${a.householdId}/items/${a.itemId}/status`, payload: { status: 'OUT' } },
      { method: 'POST' as const, url: `/v1/households/${a.householdId}/invites` },
      // Item de A acessado pela casa de B:
      { method: 'PATCH' as const, url: `/v1/households/${b.householdId}/items/${a.itemId}`, payload: { name: 'hack' } },
      { method: 'POST' as const, url: `/v1/households/${b.householdId}/items/${a.itemId}/status`, payload: { status: 'OUT' } },
    ];
    for (const attempt of attempts) {
      const r = await ctx.app.inject({ ...attempt, headers: asB });
      expect(r.statusCode, `${attempt.method} ${attempt.url}`).toBe(404);
    }

    // Compra na casa de B tentando dividir com a pessoa de A.
    const cross = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${b.householdId}/purchases`,
      headers: asB,
      payload: { title: 'Feira', amountCents: 1000, participantIds: [b.user.userId, a.user.userId] },
    });
    expect(cross.statusCode).toBe(400);

    const item = await ctx.prisma.item.findUniqueOrThrow({ where: { id: a.itemId } });
    expect(item.status).toBe('OK');
    expect(item.name).toBe('Papel higiênico');
  });

  it('fotos: tipo real validado pelos bytes e acesso restrito à casa', async () => {
    const a = await householdWithItem('Ana');
    const b = await householdWithItem('Beto');

    const upload = (householdId: string, token: string, bytes: Buffer, filename: string) => {
      const boundary = '----supplysync';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return ctx.app.inject({
        method: 'POST',
        url: `/v1/households/${householdId}/photos`,
        headers: { ...auth(token), 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
    };

    const fake = await upload(a.householdId, a.user.accessToken, Buffer.from('<?php system($_GET["c"]); ?>xxxxxxxx'), 'shell.jpg');
    expect(fake.statusCode).toBe(415);

    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
    const ok = await upload(a.householdId, a.user.accessToken, jpeg, '../../etc/passwd');
    expect(ok.statusCode).toBe(201);
    const photoId = ok.json().id as string;

    const own = await ctx.app.inject({ method: 'GET', url: `/v1/households/${a.householdId}/photos/${photoId}`, headers: auth(a.user.accessToken) });
    expect(own.statusCode).toBe(200);
    expect(own.headers['content-type']).toBe('image/jpeg');

    const stolen = await ctx.app.inject({ method: 'GET', url: `/v1/households/${b.householdId}/photos/${photoId}`, headers: auth(b.user.accessToken) });
    expect(stolen.statusCode).toBe(404);

    // Foto de outra casa não pode ser anexada a um item.
    const attach = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${b.householdId}/items/${b.itemId}/status`,
      headers: auth(b.user.accessToken),
      payload: { status: 'LOW', photoId },
    });
    expect(attach.statusCode).toBe(400);
  });
});

describe('SSRF e configuração', () => {
  it('saída HTTP só para hosts da allowlist', async () => {
    for (const url of ['http://exp.host/x', 'https://169.254.169.254/latest', 'https://localhost:5432', 'https://exp.host:8443/x', 'https://user:pw@exp.host/']) {
      await expect(safeFetch(url)).rejects.toBeInstanceOf(OutboundBlockedError);
    }
  });

  it('produção sem antibot, e-mail real ou TLS no banco não sobe', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@db/x',
        JWT_ACCESS_SECRET: 'a'.repeat(16) + 'bcdefghijklmnopqrstuvwxyz',
        TOKEN_HASH_SECRET: 'b'.repeat(16) + 'cdefghijklmnopqrstuvwxyz0',
        PASSWORD_PEPPER: 'c'.repeat(16) + 'defghijklmnopqrstuvwxyz01',
      }),
    ).toThrow(/Antibot|E-mail real|sslmode/);
  });

  it('segredos fracos são recusados', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: 'curto', TOKEN_HASH_SECRET: 'x', PASSWORD_PEPPER: 'y' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
