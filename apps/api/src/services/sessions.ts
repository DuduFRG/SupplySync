import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AuthTokens } from '@supplysync/shared';
import { keyedHash, randomToken } from '../lib/crypto';
import { Errors } from '../lib/errors';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type SignAccess = (payload: { sub: string; tv: number }) => string;

/**
 * Sessões com access token curto (JWT, 15 min, só em memória no app) e
 * refresh token opaco rotativo (guardado no Keychain/Keystore do aparelho).
 *
 * Cada uso do refresh token gera um novo e revoga o anterior. Se um token já
 * revogado for reapresentado, entendemos que houve roubo e revogamos a família inteira.
 */
export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hashSecret: string,
    private readonly signAccess: SignAccess,
  ) {}

  async issue(user: { id: string; tokenVersion: number }, familyId: string = randomUUID()): Promise<AuthTokens> {
    const refreshToken = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: keyedHash(this.hashSecret, refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return {
      accessToken: this.signAccess({ sub: user.id, tv: user.tokenVersion }),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = keyedHash(this.hashSecret, refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, tokenVersion: true, deletedAt: true } } },
    });

    if (!record) throw Errors.unauthorized();

    if (record.revokedAt) {
      // Reuso de token revogado: possível roubo. Derruba a sessão inteira.
      await this.revokeFamily(record.familyId);
      throw Errors.unauthorized();
    }

    if (record.expiresAt <= new Date() || record.user.deletedAt) throw Errors.unauthorized();

    // Revogação condicional: só uma requisição concorrente consegue rotacionar.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(record.familyId);
      throw Errors.unauthorized();
    }

    return this.issue(record.user, record.familyId);
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = keyedHash(this.hashSecret, refreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, select: { familyId: true } });
    if (record) await this.revokeFamily(record.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Encerra todas as sessões do usuário (troca de senha, exclusão de conta). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ]);
  }
}
