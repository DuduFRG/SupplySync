/**
 * Divisão de custos em centavos inteiros. Nunca usamos ponto flutuante para dinheiro.
 */

export interface Share {
  userId: string;
  shareCents: number;
}

/**
 * Divide um valor igualmente. Os centavos que sobram vão, um a um, para os
 * primeiros participantes em ordem estável de id, para que API e app
 * produzam exatamente o mesmo resultado.
 */
export function splitEvenly(amountCents: number, participantIds: readonly string[]): Share[] {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new RangeError('amountCents precisa ser um inteiro não negativo');
  }
  const unique = [...new Set(participantIds)].sort();
  if (unique.length === 0) throw new RangeError('É preciso ao menos um participante');

  const base = Math.floor(amountCents / unique.length);
  let remainder = amountCents - base * unique.length;

  return unique.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userId, shareCents: base + extra };
  });
}

export interface LedgerPurchase {
  buyerId: string;
  amountCents: number;
  shares: readonly Share[];
}

export interface LedgerSettlement {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

/**
 * Saldo líquido por pessoa. Positivo: tem a receber. Negativo: deve.
 * A soma de todos os saldos é sempre zero.
 */
export function computeBalances(
  purchases: readonly LedgerPurchase[],
  settlements: readonly LedgerSettlement[],
  memberIds: readonly string[] = [],
): Record<string, number> {
  const balances: Record<string, number> = {};
  const add = (id: string, delta: number) => {
    balances[id] = (balances[id] ?? 0) + delta;
  };

  for (const id of memberIds) balances[id] = 0;

  for (const p of purchases) {
    add(p.buyerId, p.amountCents);
    for (const s of p.shares) add(s.userId, -s.shareCents);
  }

  for (const s of settlements) {
    add(s.fromUserId, s.amountCents);
    add(s.toUserId, -s.amountCents);
  }

  return balances;
}

export interface Transfer {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

/**
 * Sugere o menor conjunto prático de transferências para zerar os saldos
 * (algoritmo guloso: maior devedor paga ao maior credor).
 */
export function suggestTransfers(balances: Readonly<Record<string, number>>): Transfer[] {
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amount: -v }));
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amount: v }));

  const byAmountDesc = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || a.id.localeCompare(b.id);

  const transfers: Transfer[] = [];
  debtors.sort(byAmountDesc);
  creditors.sort(byAmountDesc);

  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!;
    const creditor = creditors[c]!;
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) transfers.push({ fromUserId: debtor.id, toUserId: creditor.id, amountCents: amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) d++;
    if (creditor.amount === 0) c++;
  }

  return transfers;
}
