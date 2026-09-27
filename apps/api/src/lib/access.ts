import type { FastifyRequest } from 'fastify';
import type { Household, Membership } from '@prisma/client';
import { z } from 'zod';
import { idSchema } from '@supplysync/shared';
import { Errors } from './errors';
import { parse } from './validate';

const householdParams = z.object({ householdId: idSchema }).loose();

/**
 * Guarda de autorização por objeto (anti-IDOR/BOLA).
 *
 * Toda rota com :householdId passa por aqui. Se a pessoa não é membro,
 * respondemos 404, exatamente como se a casa não existisse, para não permitir
 * descobrir IDs válidos. Depois disso, toda consulta filtra por householdId.
 */
export async function requireMembership(
  request: FastifyRequest,
): Promise<{ householdId: string; membership: Membership & { household: Household } }> {
  const { householdId } = parse(householdParams, request.params);
  const membership = await request.server.services.prisma.membership.findUnique({
    where: { userId_householdId: { userId: request.userId, householdId } },
    include: { household: true },
  });
  if (!membership) throw Errors.notFound();
  return { householdId, membership };
}

export function requireOwner(membership: Membership): void {
  if (membership.role !== 'OWNER') throw Errors.forbidden('Apenas quem administra a casa pode fazer isso');
}
