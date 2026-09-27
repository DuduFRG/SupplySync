import type { Redis } from 'ioredis';

/**
 * Contadores de janela fixa para limites que não dependem de IP:
 * por e-mail (login, códigos) e por usuário autenticado.
 * Em produção com mais de uma instância, use Redis (REDIS_URL).
 */
export interface Throttle {
  /** Registra uma tentativa. Retorna false se o limite foi excedido. */
  hit(key: string, max: number, windowSeconds: number): Promise<boolean>;
  reset(key: string): Promise<void>;
}

export class MemoryThrottle implements Throttle {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
    }, 60_000);
    this.sweeper.unref();
  }

  async hit(key: string, max: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= max;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

export class RedisThrottle implements Throttle {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, max: number, windowSeconds: number): Promise<boolean> {
    const k = `throttle:${key}`;
    const results = await this.redis.multi().incr(k).expire(k, windowSeconds, 'NX').exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    return count <= max;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`throttle:${key}`);
  }
}
