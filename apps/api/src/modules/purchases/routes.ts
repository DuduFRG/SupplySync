import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  computeBalances,
  idSchema,
  PLAN_LIMITS,
  purchaseCreateSchema,
  settlementCreateSchema,
  splitEvenly,
  suggestTransfers,
  type BalancesDTO,
  type PurchaseDTO,
  type SettlementDTO,
} from '@supplysync/shared';
import type { Purchase, PurchaseShare } from '@prisma/client';
import { requireMembership } from '../../lib/access';
import { Errors } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { memberIdsInOrder } from '../households/service';

const listQuery = z.strictObject({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function toPurchaseDTO(p: Purchase & { shares: PurchaseShare[] }): PurchaseDTO {
  return {
    id: p.id,
    itemId: p.itemId,
    title: p.title,
    buyerId: p.buyerId,
    amountCents: p.amountCents,
    quantity: p.quantity,
    note: p.note,
    purchasedAt: p.purchasedAt.toISOString(),
    shares: p.shares.map((s) => ({ userId: s.userId, shareCents: s.shareCents })),
  };
}

export async function purchaseRoutes(app: FastifyInstance) {
  const { prisma } = app.services;

  app.post('/purchases', async (request, reply) => {
    const { householdId } = await requireMembership(request);
    const body = parse(purchaseCreateSchema, request.body);
    const buyerId = body.buyerId ?? request.userId;

    // Quem pagou e quem divide precisam morar na casa agora.
    const members = new Set(await memberIdsInOrder(prisma, householdId));
    if (!members.has(buyerId)) throw Errors.badRequest('Confira os dados enviados', { buyerId: 'Pessoa não faz parte da casa' });
    if (body.participantIds.some((id) => !members.has(id))) {
      throw Errors.badRequest('Confira os dados enviados', { participantIds: 'Alguém selecionado não faz parte da casa' });
    }

    const item = body.itemId
      ? await prisma.item.findFirst({ where: { id: body.itemId, householdId, archivedAt: null } })
      : null;
    if (body.itemId && !item) throw Errors.notFound('Item não encontrado');

    const shares = splitEvenly(body.amountCents, body.participantIds);
    const now = new Date();

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          householdId,
          itemId: item?.id ?? null,
          title: item?.name ?? body.title!,
          buyerId,
          createdById: request.userId,
          amountCents: body.amountCents,
          quantity: body.quantity,
          note: body.note ?? null,
          purchasedAt: now,
          shares: { create: shares },
        },
        include: { shares: true },
      });

      if (item) {
        // Comprou: o item volta a "em dia" e o rodízio avança.
        await tx.item.update({
          where: { id: item.id },
          data: {
            status: 'OK',
            lastBuyerId: buyerId,
            statusChangedAt: now,
            statusChangedById: request.userId,
            lastPhotoId: null,
            typicalPriceCents: item.typicalPriceCents ?? Math.round(body.amountCents / body.quantity),
          },
        });
        await tx.statusEvent.create({
          data: { householdId, itemId: item.id, status: 'OK', userId: request.userId, note: 'Reposto' },
        });
      }
      return created;
    });

    return reply.status(201).send(toPurchaseDTO(purchase));
  });

  app.get('/purchases', async (request) => {
    const { householdId, membership } = await requireMembership(request);
    const query = parse(listQuery, request.query);
    const since = new Date(Date.now() - PLAN_LIMITS[membership.household.plan].historyDays * 86_400_000);

    const rows = await prisma.purchase.findMany({
      where: { householdId, purchasedAt: { gte: since } },
      orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { shares: true },
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    return {
      purchases: page.map(toPurchaseDTO),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      historyDays: PLAN_LIMITS[membership.household.plan].historyDays,
    };
  });

  /** Saldos consideram todo o histórico, independentemente do plano: dívida não expira. */
  app.get('/balances', async (request): Promise<BalancesDTO> => {
    const { householdId } = await requireMembership(request);
    const [memberIds, purchases, settlements] = await Promise.all([
      memberIdsInOrder(prisma, householdId),
      prisma.purchase.findMany({ where: { householdId }, select: { buyerId: true, amountCents: true, shares: true } }),
      prisma.settlement.findMany({ where: { householdId }, select: { fromUserId: true, toUserId: true, amountCents: true } }),
    ]);

    const balances = computeBalances(purchases, settlements, memberIds);
    const formerIds = Object.keys(balances).filter((id) => !memberIds.includes(id) && balances[id] !== 0);
    const former = formerIds.length
      ? await prisma.user.findMany({ where: { id: { in: formerIds } }, select: { id: true, displayName: true } })
      : [];

    return {
      balances: Object.entries(balances).map(([userId, netCents]) => ({ userId, netCents })),
      transfers: suggestTransfers(balances),
      formerMembers: former.map((u) => ({ userId: u.id, displayName: u.displayName })),
    };
  });

  app.post('/settlements', async (request, reply) => {
    const { householdId } = await requireMembership(request);
    const body = parse(settlementCreateSchema, request.body);

    // Só quem participa do pagamento pode registrá-lo.
    if (body.fromUserId !== request.userId && body.toUserId !== request.userId) {
      throw Errors.forbidden('Você só pode registrar pagamentos dos quais participa');
    }
    const members = new Set(await memberIdsInOrder(prisma, householdId));
    if (!members.has(body.fromUserId) || !members.has(body.toUserId)) {
      throw Errors.badRequest('Confira os dados enviados', { toUserId: 'Pessoa não faz parte da casa' });
    }

    const s = await prisma.settlement.create({ data: { ...body, householdId, createdById: request.userId } });
    const dto: SettlementDTO = {
      id: s.id,
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amountCents: s.amountCents,
      createdAt: s.createdAt.toISOString(),
    };
    return reply.status(201).send(dto);
  });
}
