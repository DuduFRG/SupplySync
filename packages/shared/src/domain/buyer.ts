import type { BuyerMode } from '../constants';

export interface SuggestBuyerInput {
  mode: BuyerMode;
  /** Membros atuais da casa, na ordem de entrada. Define a ordem do rodízio. */
  memberIds: readonly string[];
  preferredUserId?: string | null;
  /** Quem comprou este item da última vez. */
  lastBuyerId?: string | null;
  /** Total gasto recentemente por membro (centavos). Usado no modo FAIR. */
  recentSpendCents?: Readonly<Record<string, number>>;
}

/**
 * Sugere quem deve comprar um item.
 *
 * - ROTATION: o próximo membro depois de quem comprou por último.
 * - PREFERRED: a pessoa escolhida para o item; se ela saiu da casa, cai no rodízio.
 * - FAIR: quem gastou menos recentemente; empate é resolvido pela ordem do rodízio.
 *
 * Função pura e determinística: a API e o app chegam sempre ao mesmo resultado.
 */
export function suggestBuyer(input: SuggestBuyerInput): string | null {
  const { memberIds } = input;
  if (memberIds.length === 0) return null;

  if (input.mode === 'PREFERRED' && input.preferredUserId && memberIds.includes(input.preferredUserId)) {
    return input.preferredUserId;
  }

  const rotationOrder = rotationFrom(memberIds, input.lastBuyerId ?? null);

  if (input.mode === 'FAIR') {
    const spend = input.recentSpendCents ?? {};
    let best = rotationOrder[0]!;
    let bestSpend = spend[best] ?? 0;
    for (const id of rotationOrder) {
      const value = spend[id] ?? 0;
      if (value < bestSpend) {
        best = id;
        bestSpend = value;
      }
    }
    return best;
  }

  return rotationOrder[0]!;
}

/** Ordem do rodízio começando pelo membro seguinte a `lastBuyerId`. */
export function rotationFrom(memberIds: readonly string[], lastBuyerId: string | null): string[] {
  const index = lastBuyerId ? memberIds.indexOf(lastBuyerId) : -1;
  if (index === -1) return [...memberIds];
  const start = (index + 1) % memberIds.length;
  return [...memberIds.slice(start), ...memberIds.slice(0, start)];
}
