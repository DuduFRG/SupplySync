import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createHouseholdSchema,
  idSchema,
  INVITE_MAX_USES,
  INVITE_TTL_DAYS,
  joinHouseholdSchema,
  PLAN_LIMITS,
  updateHouseholdSchema,
  type InviteDTO,
} from '@supplysync/shared';
import type { PrismaClient } from '@prisma/client';
import { requireMembership, requireOwner } from '../../lib/access';
import { keyedHash, randomInviteCode } from '../../lib/crypto';
import { AppError, Errors } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { getHouseholdDTO, removeMember } from './service';

const memberParams = z.object({ householdId: idSchema, userId: idSchema });

/** O limite de casas por pessoa segue o melhor plano entre as casas dela. */
async function assertCanJoinAnotherHousehold(prisma: PrismaClient, userId: string) {
  const memberships = await prisma.membership.findMany({ where: { userId }, select: { household: { select: { plan: true } } } });
  const best = memberships.some((m) => m.household.plan === 'FAMILY') ? 'FAMILY' : 'FREE';
  if (memberships.length >= PLAN_LIMITS[best].maxHouseholdsPerUser) {
    throw Errors.planLimit(
      best === 'FREE'
        ? 'No plano gratuito você participa de 1 casa. Saia da atual ou assine o plano Família.'
        : 'Você atingiu o limite de casas do seu plano.',
    );
  }
}

export async function householdRoutes(app: FastifyInstance) {
  const { prisma, throttle, config } = app.services;

  app.post('/', async (request, reply) => {
    const body = parse(createHouseholdSchema, request.body);
    await assertCanJoinAnotherHousehold(prisma, request.userId);

    const household = await prisma.household.create({
      data: { name: body.name, memberships: { create: { userId: request.userId, role: 'OWNER' } } },
    });
    return reply.status(201).send(await getHouseholdDTO(prisma, household.id, request.userId));
  });

  app.post('/join', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request) => {
    const body = parse(joinHouseholdSchema, request.body);
    if (!(await throttle.hit(`join:${request.userId}`, 10, 3600))) {
      throw new AppError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco.');
    }

    const invalid = () => new AppError(400, 'INVALID_INVITE', 'Convite inválido ou expirado');
    const invite = await prisma.invite.findUnique({
      where: { codeHash: keyedHash(config.TOKEN_HASH_SECRET, `invite:${body.code}`) },
      include: { household: { include: { _count: { select: { memberships: true } } } } },
    });
    if (!invite || invite.revokedAt || invite.expiresAt <= new Date() || invite.uses >= invite.maxUses) throw invalid();

    const already = await prisma.membership.findUnique({
      where: { userId_householdId: { userId: request.userId, householdId: invite.householdId } },
    });
    if (already) throw Errors.conflict('Você já faz parte desta casa');

    await assertCanJoinAnotherHousehold(prisma, request.userId);
    if (invite.household._count.memberships >= PLAN_LIMITS[invite.household.plan].maxMembers) {
      throw Errors.planLimit('Esta casa atingiu o limite de moradores do plano.');
    }

    await prisma.$transaction(async (tx) => {
      // Incremento condicional: dois aceites simultâneos não ultrapassam maxUses.
      const { count } = await tx.invite.updateMany({
        where: { id: invite.id, uses: { lt: invite.maxUses }, revokedAt: null },
        data: { uses: { increment: 1 } },
      });
      if (count === 0) throw invalid();
      await tx.membership.create({ data: { userId: request.userId, householdId: invite.householdId, role: 'MEMBER' } });
    });

    return getHouseholdDTO(prisma, invite.householdId, request.userId);
  });

  app.get('/:householdId', async (request) => {
    const { householdId } = await requireMembership(request);
    return getHouseholdDTO(prisma, householdId, request.userId);
  });

  app.patch('/:householdId', async (request) => {
    const { householdId, membership } = await requireMembership(request);
    requireOwner(membership);
    const body = parse(updateHouseholdSchema, request.body);
    await prisma.household.update({ where: { id: householdId }, data: { name: body.name } });
    return getHouseholdDTO(prisma, householdId, request.userId);
  });

  app.post('/:householdId/invites', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { householdId, membership } = await requireMembership(request);
    const count = await prisma.membership.count({ where: { householdId } });
    if (count >= PLAN_LIMITS[membership.household.plan].maxMembers) {
      throw Errors.planLimit('A casa já está com o número máximo de moradores do plano.');
    }

    const code = randomInviteCode();
    const invite = await prisma.invite.create({
      data: {
        householdId,
        createdById: request.userId,
        codeHash: keyedHash(config.TOKEN_HASH_SECRET, `invite:${code}`),
        maxUses: INVITE_MAX_USES,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
    });
    // O código em claro só existe nesta resposta.
    const dto: InviteDTO = { code, expiresAt: invite.expiresAt.toISOString(), maxUses: invite.maxUses };
    return reply.status(201).send(dto);
  });

  app.delete('/:householdId/members/me', async (request, reply) => {
    const { householdId } = await requireMembership(request);
    await prisma.$transaction((tx) => removeMember(tx, householdId, request.userId));
    return reply.status(204).send();
  });

  app.delete('/:householdId/members/:userId', async (request, reply) => {
    const { householdId, membership } = await requireMembership(request);
    requireOwner(membership);
    const { userId } = parse(memberParams, request.params);
    if (userId === request.userId) throw Errors.badRequest('Para sair da casa, use a opção "Sair da casa"');

    const target = await prisma.membership.findUnique({ where: { userId_householdId: { userId, householdId } } });
    if (!target) throw Errors.notFound();
    await prisma.$transaction((tx) => removeMember(tx, householdId, userId));
    return reply.status(204).send();
  });
}
