import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RedisThrottle } from '../src/services/throttle';
import { createTestContext, type TestContext } from './helpers';

/**
 * Rate limiting distribuído com Redis real. Garante que o limite vale para
 * todas as réplicas da API e que atualizações do cliente Redis não quebram nada.
 * Roda quando TEST_REDIS_URL está definido (o CI define).
 */
const REDIS_URL = process.env.TEST_REDIS_URL;

describe.skipIf(!REDIS_URL)('Redis', () => {
  let redis: Redis;
  let replicaA: TestContext;
  let replicaB: TestContext;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL!);
    replicaA = await createTestContext({ REDIS_URL: REDIS_URL! });
    replicaB = await createTestContext({ REDIS_URL: REDIS_URL! });
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await replicaA.app.close();
    await replicaB.app.close();
    redis.disconnect();
  });

  it('throttle conta tentativas, expira a janela e pode ser zerado', async () => {
    const throttle = new RedisThrottle(redis);
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await throttle.hit('login:ana@exemplo.com', 2, 60));
    expect(results).toEqual([true, true, false]);

    const ttl = await redis.ttl('throttle:login:ana@exemplo.com');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    await throttle.reset('login:ana@exemplo.com');
    expect(await throttle.hit('login:ana@exemplo.com', 2, 60)).toBe(true);
  });

  it('a janela não é renovada a cada tentativa', async () => {
    const throttle = new RedisThrottle(redis);
    await throttle.hit('k', 5, 60);
    await redis.expire('throttle:k', 5);
    await throttle.hit('k', 5, 60);
    expect(await redis.ttl('throttle:k')).toBeLessThanOrEqual(5);
  });

  it('limite por IP é compartilhado entre réplicas da API', async () => {
    // /health aceita 60 requisições por minuto por IP.
    for (let i = 0; i < 30; i++) {
      expect((await replicaA.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
      expect((await replicaB.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    }
    const blocked = await replicaA.app.inject({ method: 'GET', url: '/health' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
    expect((await replicaB.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(429);
  });
});

describe('Redis fora do ar', () => {
  it('a API continua respondendo e a proteção de login continua ativa', async () => {
    const ctx = await createTestContext({ REDIS_URL: 'redis://127.0.0.1:1/0' });
    try {
      expect((await ctx.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);

      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await ctx.app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email: 'ninguem@exemplo.com', password: `errada ${i}` },
        });
        statuses.push(r.statusCode);
      }
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      await ctx.app.close();
    }
  });
});
