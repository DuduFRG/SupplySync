import { describe, expect, it } from 'vitest';
import { computeBalances, splitEvenly, suggestBuyer, suggestTransfers } from '../src';

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const C = 'c0000000-0000-4000-8000-000000000003';

describe('suggestBuyer', () => {
  it('rodízio: próximo depois do último comprador, com volta ao início', () => {
    expect(suggestBuyer({ mode: 'ROTATION', memberIds: [A, B, C], lastBuyerId: A })).toBe(B);
    expect(suggestBuyer({ mode: 'ROTATION', memberIds: [A, B, C], lastBuyerId: C })).toBe(A);
    expect(suggestBuyer({ mode: 'ROTATION', memberIds: [A, B, C] })).toBe(A);
  });

  it('rodízio: último comprador que saiu da casa reinicia a ordem', () => {
    expect(suggestBuyer({ mode: 'ROTATION', memberIds: [B, C], lastBuyerId: A })).toBe(B);
  });

  it('preferência: respeita a pessoa escolhida e cai no rodízio se ela saiu', () => {
    expect(suggestBuyer({ mode: 'PREFERRED', memberIds: [A, B, C], preferredUserId: C, lastBuyerId: C })).toBe(C);
    expect(suggestBuyer({ mode: 'PREFERRED', memberIds: [A, B], preferredUserId: C, lastBuyerId: A })).toBe(B);
  });

  it('equilíbrio: quem gastou menos, empate pela ordem do rodízio', () => {
    expect(
      suggestBuyer({ mode: 'FAIR', memberIds: [A, B, C], recentSpendCents: { [A]: 500, [B]: 100, [C]: 900 } }),
    ).toBe(B);
    expect(suggestBuyer({ mode: 'FAIR', memberIds: [A, B, C], lastBuyerId: A, recentSpendCents: {} })).toBe(B);
  });

  it('casa vazia não sugere ninguém', () => {
    expect(suggestBuyer({ mode: 'ROTATION', memberIds: [] })).toBeNull();
  });
});

describe('splitEvenly', () => {
  it('distribui centavos restantes de forma determinística', () => {
    const shares = splitEvenly(1000, [C, A, B]);
    expect(shares).toEqual([
      { userId: A, shareCents: 334 },
      { userId: B, shareCents: 333 },
      { userId: C, shareCents: 333 },
    ]);
    expect(shares.reduce((s, x) => s + x.shareCents, 0)).toBe(1000);
  });

  it('rejeita valores inválidos', () => {
    expect(() => splitEvenly(10.5, [A])).toThrow();
    expect(() => splitEvenly(100, [])).toThrow();
  });
});

describe('saldos e acertos', () => {
  it('saldos somam zero e transferências zeram as dívidas', () => {
    const purchases = [
      { buyerId: A, amountCents: 3000, shares: splitEvenly(3000, [A, B, C]) },
      { buyerId: B, amountCents: 1500, shares: splitEvenly(1500, [A, B, C]) },
    ];
    const balances = computeBalances(purchases, [], [A, B, C]);
    expect(Object.values(balances).reduce((s, v) => s + v, 0)).toBe(0);
    expect(balances).toEqual({ [A]: 1500, [B]: 0, [C]: -1500 });

    const transfers = suggestTransfers(balances);
    expect(transfers).toEqual([{ fromUserId: C, toUserId: A, amountCents: 1500 }]);

    const after = computeBalances(purchases, transfers, [A, B, C]);
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
});
