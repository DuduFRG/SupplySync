import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { deleteMeSchema, pushTokenSchema, updateMeSchema, type MeDTO } from '@supplysync/shared';
import { AppError } from '../../lib/errors';
import { NO_PASSWORD } from '../../lib/password';
import { parse } from '../../lib/validate';
import { removeMember } from '../households/service';

const removePushTokenSchema = pushTokenSchema.pick({ token: true });

export async function meRoutes(app: FastifyInstance) {
  const { prisma, passwords, sessions, social } = app.services;

  const userSelect = {
    id: true,
    email: true,
    displayName: true,
    passwordHash: true,
    identities: { select: { provider: true } },
  } as const;

  const toUserDTO = (u: { id: string; email: string; displayName: string; passwordHash: string; identities: { provider: string }[] }) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    hasPassword: u.passwordHash !== NO_PASSWORD,
    providers: u.identities.map((i) => i.provider).filter((p): p is 'google' | 'apple' => p === 'google' || p === 'apple'),
  });

  app.get('/', async (request): Promise<MeDTO> => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: {
        ...userSelect,
        memberships: { orderBy: { createdAt: 'asc' }, select: { role: true, household: { select: { id: true, name: true, plan: true } } } },
      },
    });
    return {
      user: toUserDTO(user),
      households: user.memberships.map((m) => ({ ...m.household, role: m.role })),
    };
  });

  app.patch('/', async (request) => {
    const body = parse(updateMeSchema, request.body);
    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { displayName: body.displayName },
      select: userSelect,
    });
    return { user: toUserDTO(user) };
  });

  /**
   * Exclusão de conta (exigência da App Store e do Google Play).
   * Dados pessoais são apagados; lançamentos financeiros ficam associados a um
   * perfil anônimo para não quebrar as contas de quem continua na casa.
   */
  app.delete('/', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = parse(deleteMeSchema, request.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } });

    if ('password' in body) {
      if (!(await passwords.verify(user.passwordHash, body.password))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Senha incorreta');
      }
    } else {
      // Conta com Google/Apple: a pessoa entra de novo pelo provedor e o login precisa ser desta conta.
      const identity = await social.verify(body.provider, body.idToken, body.nonce);
      const owned = await prisma.userIdentity.findFirst({
        where: { userId: user.id, provider: identity.provider, subject: identity.subject },
      });
      if (!owned) throw new AppError(401, 'INVALID_CREDENTIALS', 'Esse login não é desta conta');
    }

    const memberships = await prisma.membership.findMany({ where: { userId: user.id }, select: { householdId: true } });
    await prisma.$transaction(async (tx) => {
      for (const m of memberships) await removeMember(tx, m.householdId, user.id);
      await tx.pushToken.deleteMany({ where: { userId: user.id } });
      await tx.emailCode.deleteMany({ where: { userId: user.id } });
      // Libera o Google/Apple da pessoa para, se quiser, criar uma conta nova no futuro.
      await tx.userIdentity.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${randomUUID()}@invalid.supplysync`,
          displayName: 'Ex-morador',
          passwordHash: NO_PASSWORD,
          deletedAt: new Date(),
        },
      });
    });
    await sessions.revokeAllForUser(user.id);
    return reply.status(204).send();
  });

  app.post('/push-tokens', async (request, reply) => {
    const body = parse(pushTokenSchema, request.body);
    // Um aparelho pertence a uma conta por vez: o token migra se outra pessoa entrar nele.
    await prisma.pushToken.upsert({
      where: { token: body.token },
      create: { token: body.token, platform: body.platform, userId: request.userId },
      update: { userId: request.userId, platform: body.platform },
    });
    return reply.status(204).send();
  });

  app.delete('/push-tokens', async (request, reply) => {
    const body = parse(removePushTokenSchema, request.body);
    await prisma.pushToken.deleteMany({ where: { token: body.token, userId: request.userId } });
    return reply.status(204).send();
  });
}
