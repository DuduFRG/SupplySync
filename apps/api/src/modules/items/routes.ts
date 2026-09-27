import type { FastifyInstance } from 'fastify';
import type { Item, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  idSchema,
  itemBulkCreateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  PLAN_LIMITS,
  reportStatusSchema,
  suggestBuyer,
  type ItemDTO,
  type Plan,
  type StatusEventDTO,
} from '@supplysync/shared';
import { requireMembership } from '../../lib/access';
import { Errors } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { memberIdsInOrder } from '../households/service';

const itemParams = z.object({ householdId: idSchema, itemId: idSchema });
const STATUS_ORDER = { OUT: 0, LOW: 1, OK: 2 } as const;
const FAIR_WINDOW_DAYS = 60;

interface BuyerContext {
  memberIds: string[];
  recentSpendCents: Record<string, number>;
}

async function loadBuyerContext(prisma: PrismaClient, householdId: string): Promise<BuyerContext> {
  const since = new Date(Date.now() - FAIR_WINDOW_DAYS * 86_400_000);
  const [memberIds, spend] = await Promise.all([
    memberIdsInOrder(prisma, householdId),
    prisma.purchase.groupBy({
      by: ['buyerId'],
      where: { householdId, purchasedAt: { gte: since } },
      _sum: { amountCents: true },
    }),
  ]);
  const recentSpendCents: Record<string, number> = {};
  for (const row of spend) recentSpendCents[row.buyerId] = row._sum.amountCents ?? 0;
  return { memberIds, recentSpendCents };
}

export function toItemDTO(item: Item, ctx: BuyerContext): ItemDTO {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    critical: item.critical,
    status: item.status,
    buyerMode: item.buyerMode,
    preferredUserId: item.preferredUserId,
    typicalPriceCents: item.typicalPriceCents,
    lastBuyerId: item.lastBuyerId,
    suggestedBuyerId: suggestBuyer({
      mode: item.buyerMode,
      memberIds: ctx.memberIds,
      preferredUserId: item.preferredUserId,
      lastBuyerId: item.lastBuyerId,
      recentSpendCents: ctx.recentSpendCents,
    }),
    statusChangedAt: item.statusChangedAt.toISOString(),
    statusChangedById: item.statusChangedById,
    lastPhotoId: item.lastPhotoId,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function itemRoutes(app: FastifyInstance) {
  const { prisma, push } = app.services;

  async function assertItemCapacity(householdId: string, plan: Plan, adding: number) {
    const count = await prisma.item.count({ where: { householdId, archivedAt: null } });
    const { maxItems } = PLAN_LIMITS[plan];
    if (count + adding > maxItems) {
      throw Errors.planLimit(
        plan === 'FREE'
          ? `O plano gratuito acompanha até ${maxItems} itens. Arquive algum ou assine o plano Família.`
          : `Limite de ${maxItems} itens atingido.`,
      );
    }
  }

  /** A pessoa preferida precisa ser moradora desta casa (impede referência cruzada entre casas). */
  async function assertMember(householdId: string, userId: string | null | undefined) {
    if (!userId) return;
    const found = await prisma.membership.findUnique({ where: { userId_householdId: { userId, householdId } } });
    if (!found) throw Errors.badRequest('Confira os dados enviados', { preferredUserId: 'Pessoa não faz parte da casa' });
  }

  async function findItem(householdId: string, itemId: string) {
    // householdId no filtro: um item de outra casa simplesmente "não existe".
    const item = await prisma.item.findFirst({ where: { id: itemId, householdId, archivedAt: null } });
    if (!item) throw Errors.notFound('Item não encontrado');
    return item;
  }

  app.get('/', async (request) => {
    const { householdId } = await requireMembership(request);
    const [items, ctx] = await Promise.all([
      prisma.item.findMany({ where: { householdId, archivedAt: null } }),
      loadBuyerContext(prisma, householdId),
    ]);
    items.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'pt-BR'));
    return { items: items.map((i) => toItemDTO(i, ctx)) };
  });

  app.post('/', async (request, reply) => {
    const { householdId, membership } = await requireMembership(request);
    const body = parse(itemCreateSchema, request.body);
    await assertItemCapacity(householdId, membership.household.plan, 1);
    await assertMember(householdId, body.preferredUserId);

    const item = await prisma.item.create({ data: { ...body, householdId } });
    return reply.status(201).send(toItemDTO(item, await loadBuyerContext(prisma, householdId)));
  });

  app.post('/bulk', async (request, reply) => {
    const { householdId, membership } = await requireMembership(request);
    const body = parse(itemBulkCreateSchema, request.body);
    await assertItemCapacity(householdId, membership.household.plan, body.items.length);
    for (const item of body.items) await assertMember(householdId, item.preferredUserId);

    await prisma.item.createMany({ data: body.items.map((i) => ({ ...i, householdId })) });
    return reply.status(201).send({ created: body.items.length });
  });

  app.patch('/:itemId', async (request) => {
    const { householdId } = await requireMembership(request);
    const { itemId } = parse(itemParams, request.params);
    const body = parse(itemUpdateSchema, request.body);
    await findItem(householdId, itemId);
    await assertMember(householdId, body.preferredUserId);

    const item = await prisma.item.update({ where: { id: itemId }, data: body });
    return toItemDTO(item, await loadBuyerContext(prisma, householdId));
  });

  app.delete('/:itemId', async (request, reply) => {
    const { householdId } = await requireMembership(request);
    const { itemId } = parse(itemParams, request.params);
    await findItem(householdId, itemId);
    await prisma.item.update({ where: { id: itemId }, data: { archivedAt: new Date() } });
    return reply.status(204).send();
  });

  app.post('/:itemId/status', async (request) => {
    const { householdId } = await requireMembership(request);
    const { itemId } = parse(itemParams, request.params);
    const body = parse(reportStatusSchema, request.body);
    const previous = await findItem(householdId, itemId);

    if (body.photoId) {
      const photo = await prisma.photo.findFirst({ where: { id: body.photoId, householdId } });
      if (!photo) throw Errors.badRequest('Confira os dados enviados', { photoId: 'Foto não encontrada' });
    }

    const now = new Date();
    const [item] = await prisma.$transaction([
      prisma.item.update({
        where: { id: itemId },
        data: {
          status: body.status,
          statusChangedAt: now,
          statusChangedById: request.userId,
          ...(body.photoId ? { lastPhotoId: body.photoId } : body.status === 'OK' ? { lastPhotoId: null } : {}),
        },
      }),
      prisma.statusEvent.create({
        data: {
          householdId,
          itemId,
          status: body.status,
          userId: request.userId,
          note: body.note ?? null,
          photoId: body.photoId ?? null,
        },
      }),
    ]);

    const ctx = await loadBuyerContext(prisma, householdId);
    const dto = toItemDTO(item, ctx);

    const gotWorse = STATUS_ORDER[body.status] < STATUS_ORDER[previous.status];
    if (item.critical && gotWorse && body.status !== 'OK') {
      void notifyCriticalItem(prisma, push, {
        householdId,
        itemId,
        itemName: item.name,
        status: body.status,
        reporterId: request.userId,
        suggestedBuyerId: dto.suggestedBuyerId,
        memberIds: ctx.memberIds,
      }).catch((err: unknown) => request.log.warn({ err }, 'push: critical item notification failed'));
    }

    return dto;
  });

  app.get('/:itemId/events', async (request) => {
    const { householdId } = await requireMembership(request);
    const { itemId } = parse(itemParams, request.params);
    await findItem(householdId, itemId);
    const events = await prisma.statusEvent.findMany({
      where: { itemId, householdId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const dto: StatusEventDTO[] = events.map((e) => ({
      id: e.id,
      status: e.status,
      userId: e.userId,
      note: e.note,
      photoId: e.photoId,
      createdAt: e.createdAt.toISOString(),
    }));
    return { events: dto };
  });
}

async function notifyCriticalItem(
  prisma: PrismaClient,
  push: FastifyInstance['services']['push'],
  input: {
    householdId: string;
    itemId: string;
    itemName: string;
    status: 'LOW' | 'OUT';
    reporterId: string;
    suggestedBuyerId: string | null;
    memberIds: string[];
  },
) {
  const title = input.status === 'OUT' ? `${input.itemName} acabou` : `${input.itemName} está acabando`;
  const data = { type: 'item_status', householdId: input.householdId, itemId: input.itemId };
  const others = input.memberIds.filter((id) => id !== input.reporterId);

  const buyer = input.suggestedBuyerId
    ? await prisma.user.findUnique({ where: { id: input.suggestedBuyerId }, select: { id: true, displayName: true } })
    : null;

  if (buyer && buyer.id !== input.reporterId) {
    await push.send({ userIds: [buyer.id], title, body: 'É a sua vez de comprar. Toque para ver a lista.', data });
  }
  const rest = others.filter((id) => id !== buyer?.id);
  if (rest.length > 0) {
    await push.send({
      userIds: rest,
      title,
      body: buyer ? `A vez de comprar é de ${buyer.displayName}.` : 'Item essencial da casa precisa de reposição.',
      data,
    });
  }
}
