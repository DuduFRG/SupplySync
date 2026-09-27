import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { MemoryMailer } from '../src/services/mailer';
import { MemoryPushSender } from '../src/services/push';

export { TEST_DATABASE_URL } from './setup-db';
import { TEST_DATABASE_URL } from './setup-db';

export function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_ACCESS_SECRET: 'test-jwt-secret-0123456789-abcdefghijklmnop',
    TOKEN_HASH_SECRET: 'test-hash-secret-0123456789-abcdefghijklmnop',
    PASSWORD_PEPPER: 'test-pepper-secret-0123456789-abcdefghijklmnop',
    STORAGE_DIR: mkdtempSync(path.join(tmpdir(), 'supplysync-photos-')),
  });
}

export interface TestContext {
  app: FastifyInstance;
  prisma: PrismaClient;
  mailer: MemoryMailer;
  push: MemoryPushSender;
}

export async function createTestContext(): Promise<TestContext> {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  const mailer = new MemoryMailer();
  const push = new MemoryPushSender();
  const app = await buildApp({ config: testConfig(), prisma, overrides: { mailer, push } });
  await app.ready();
  return { app, prisma, mailer, push };
}

export async function resetDatabase(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

let counter = 0;

/** Cria uma conta confirmada e devolve tokens, pelo fluxo real da API. */
export async function signUp(ctx: TestContext, name = 'Pessoa') {
  counter += 1;
  const email = `user${counter}-${Date.now()}@exemplo.com`;
  const password = 'senha forte 2026';
  const reg = await ctx.app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, password, displayName: name } });
  if (reg.statusCode !== 202) throw new Error(`register failed: ${reg.body}`);

  const code = lastCode(ctx.mailer, email);
  const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { email, code } });
  if (res.statusCode !== 200) throw new Error(`verify failed: ${res.body}`);
  const tokens = res.json() as { accessToken: string; refreshToken: string };
  const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(tokens.accessToken) });
  return { email, password, ...tokens, userId: (me.json() as { user: { id: string } }).user.id };
}

export function lastCode(mailer: MemoryMailer, email: string): string {
  const msg = [...mailer.outbox].reverse().find((m) => m.to === email);
  const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error('no code in outbox');
  return code;
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });
