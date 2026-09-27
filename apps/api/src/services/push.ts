import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Config } from '../config';
import { safeFetch } from '../lib/safe-fetch';

export interface PushMessage {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSender {
  send(message: PushMessage): Promise<void>;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Envio via Expo Push Service (que entrega em APNs e FCM).
 * Disparado sem bloquear a resposta HTTP; falhas só geram log.
 */
class ExpoPushSender implements PushSender {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly accessToken: string | undefined,
    private readonly log: FastifyBaseLogger,
  ) {}

  async send(message: PushMessage): Promise<void> {
    if (message.userIds.length === 0) return;
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: message.userIds } },
      select: { token: true },
    });
    if (tokens.length === 0) return;

    const payload = tokens.map((t) => ({
      to: t.token,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: 'default',
      priority: 'high',
    }));

    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100);
      try {
        const res = await safeFetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(chunk),
        });
        if (!res.ok) {
          this.log.warn({ status: res.status }, 'push: provider error');
          continue;
        }
        const { data } = (await res.json()) as { data?: ExpoTicket[] };
        const invalid = chunk.filter((_, idx) => data?.[idx]?.details?.error === 'DeviceNotRegistered').map((m) => m.to);
        if (invalid.length > 0) await this.prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
      } catch (err) {
        this.log.warn({ err }, 'push: send failed');
      }
    }
  }
}

export class MemoryPushSender implements PushSender {
  readonly sent: PushMessage[] = [];
  async send(message: PushMessage): Promise<void> {
    this.sent.push(message);
  }
}

export function createPushSender(config: Config, prisma: PrismaClient, log: FastifyBaseLogger): PushSender {
  return new ExpoPushSender(prisma, config.EXPO_ACCESS_TOKEN, log);
}
