import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { deleteMeSchema, pushTokenSchema, updateMeSchema, type MeDTO } from '@supplysync/shared';
import { AppError } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { removeMember } from '../households/service';

const removePushTokenSchema = pushTokenSchema.pick({ token: true });

export async function meRoutes(app: FastifyInstance) {
  const { prisma, passwords, sessions } = app.services;

  app.get('/', async (request): Promise<MeDTO> => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        memberships: { orderBy: { createdAt: 'asc' }, select: { role: true, household: { select: { id: true, name: true, plan: true } } } },
      },
    });
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      households: user.memberships.map((m) => ({ ...m.household, role: m.role })),
    };
  });

  app.patch('/', async (request) => {
    const body = parse(updateMeSchema, request.body);
    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { displayName: body.displayName },
      select: { id: true, email: true, displayName: true },
    });
    return { user };
  });

  /**
   * Exclusão de conta (exigência da App Store e do Google Play).
   * Dados pessoais são apagados; lançamentos financeiros ficam associados a um
   * perfil anônimo para não quebrar as contas de quem continua na casa.
   */
  app.delete('/', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = parse(deleteMeSchema, request.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } });
    if (!(await passwords.verify(user.passwordHash, body.password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Senha incorreta');
    }

    const memberships = await prisma.membership.findMany({ where: { userId: user.id }, select: { householdId: true } });
    await prisma.$transaction(async (tx) => {
      for (const m of memberships) await removeMember(tx, m.householdId, user.id);
      await tx.pushToken.deleteMany({ where: { userId: user.id } });
      await tx.emailCode.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${randomUUID()}@invalid.supplysync`,
          displayName: 'Ex-morador',
          passwordHash: '!',
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
