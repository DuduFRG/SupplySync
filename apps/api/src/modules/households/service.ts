import type { Prisma, PrismaClient } from '@prisma/client';
import { PLAN_LIMITS, type HouseholdDTO } from '@supplysync/shared';
import { Errors } from '../../lib/errors';

type Tx = Prisma.TransactionClient;

/**
 * Remove alguém da casa preservando o histórico financeiro.
 * - Última pessoa saindo: a casa é apagada.
 * - Administrador saindo: o membro mais antigo assume.
 */
export async function removeMember(tx: Tx, householdId: string, userId: string): Promise<void> {
  const membership = await tx.membership.findUnique({ where: { userId_householdId: { userId, householdId } } });
  if (!membership) return;

  await tx.membership.delete({ where: { id: membership.id } });
  await tx.item.updateMany({ where: { householdId, preferredUserId: userId }, data: { preferredUserId: null } });

  const remaining = await tx.membership.findMany({ where: { householdId }, orderBy: { createdAt: 'asc' } });
  if (remaining.length === 0) {
    await tx.household.delete({ where: { id: householdId } });
    return;
  }
  if (membership.role === 'OWNER' && !remaining.some((m) => m.role === 'OWNER')) {
    await tx.membership.update({ where: { id: remaining[0]!.id }, data: { role: 'OWNER' } });
  }
}

export async function getHouseholdDTO(prisma: PrismaClient, householdId: string, userId: string): Promise<HouseholdDTO> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      memberships: { orderBy: { createdAt: 'asc' }, include: { user: { select: { displayName: true } } } },
      _count: { select: { items: { where: { archivedAt: null } } } },
    },
  });
  if (!household) throw Errors.notFound();
  const mine = household.memberships.find((m) => m.userId === userId);
  if (!mine) throw Errors.notFound();

  return {
    id: household.id,
    name: household.name,
    plan: household.plan,
    limits: PLAN_LIMITS[household.plan],
    myRole: mine.role,
    itemCount: household._count.items,
    members: household.memberships.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    })),
  };
}

/** IDs dos membros atuais na ordem de entrada (ordem do rodízio). */
export async function memberIdsInOrder(db: Tx | PrismaClient, householdId: string): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: { householdId },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
