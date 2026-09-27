import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, createTestContext, resetDatabase, signUp, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.push.sent.length = 0;
});
afterAll(async () => {
  await ctx.app.close();
});

const flush = () => new Promise((r) => setTimeout(r, 50));

describe('fluxo completo da casa', () => {
  it('convite, sinalização, notificação, compra, divisão e acerto', async () => {
    const ana = await signUp(ctx, 'Ana');
    const beto = await signUp(ctx, 'Beto');
    const asAna = auth(ana.accessToken);
    const asBeto = auth(beto.accessToken);

    // Ana cria a casa e convida Beto.
    const h = await ctx.app.inject({ method: 'POST', url: '/v1/households', headers: asAna, payload: { name: 'Apê 42' } });
    expect(h.statusCode).toBe(201);
    const householdId = h.json().id as string;

    const inv = await ctx.app.inject({ method: 'POST', url: `/v1/households/${householdId}/invites`, headers: asAna });
    const code = inv.json().code as string;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await ctx.prisma.invite.count({ where: { codeHash: code } })).toBe(0); // guardado só como hash

    const join = await ctx.app.inject({
      method: 'POST',
      url: '/v1/households/join',
      headers: asBeto,
      payload: { code: `${code.slice(0, 4)}-${code.slice(4).toLowerCase()}` },
    });
    expect(join.statusCode).toBe(200);
    expect(join.json().members).toHaveLength(2);

    // Itens iniciais em lote.
    const bulk = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/items/bulk`,
      headers: asAna,
      payload: {
        items: [
          { name: 'Papel higiênico', category: 'HYGIENE', critical: true },
          { name: 'Detergente', category: 'CLEANING' },
        ],
      },
    });
    expect(bulk.statusCode).toBe(201);

    const list = await ctx.app.inject({ method: 'GET', url: `/v1/households/${householdId}/items`, headers: asBeto });
    const paper = (list.json().items as { id: string; name: string; suggestedBuyerId: string }[]).find((i) => i.name === 'Papel higiênico')!;
    expect(paper.suggestedBuyerId).toBe(ana.userId); // rodízio começa pela primeira moradora

    // Beto sinaliza que o item crítico acabou: Ana é avisada que é a vez dela.
    const report = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/items/${paper.id}/status`,
      headers: asBeto,
      payload: { status: 'OUT', note: 'Último rolo' },
    });
    expect(report.statusCode).toBe(200);
    await flush();
    expect(ctx.push.sent).toHaveLength(1);
    expect(ctx.push.sent[0]).toMatchObject({ userIds: [ana.userId], title: 'Papel higiênico acabou' });

    // Ana compra por R$ 25,01 dividindo entre os dois.
    const buy = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/purchases`,
      headers: asAna,
      payload: { itemId: paper.id, amountCents: 2501, participantIds: [ana.userId, beto.userId] },
    });
    expect(buy.statusCode).toBe(201);
    expect(buy.json().shares.reduce((s: number, x: { shareCents: number }) => s + x.shareCents, 0)).toBe(2501);

    const after = await ctx.app.inject({ method: 'GET', url: `/v1/households/${householdId}/items`, headers: asAna });
    const paperAfter = (after.json().items as { id: string; status: string; suggestedBuyerId: string }[]).find((i) => i.id === paper.id)!;
    expect(paperAfter.status).toBe('OK');
    expect(paperAfter.suggestedBuyerId).toBe(beto.userId); // rodízio avançou

    // Saldos: Beto deve metade para Ana.
    const bal = await ctx.app.inject({ method: 'GET', url: `/v1/households/${householdId}/balances`, headers: asBeto });
    const transfers = bal.json().transfers as { fromUserId: string; toUserId: string; amountCents: number }[];
    expect(transfers).toHaveLength(1);
    expect(transfers[0]!.fromUserId).toBe(beto.userId);
    expect(transfers[0]!.toUserId).toBe(ana.userId);

    // Terceiros não registram acerto em nome de outros; os próprios envolvidos sim.
    const settle = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/settlements`,
      headers: asBeto,
      payload: transfers[0],
    });
    expect(settle.statusCode).toBe(201);

    const zero = await ctx.app.inject({ method: 'GET', url: `/v1/households/${householdId}/balances`, headers: asAna });
    expect(zero.json().transfers).toEqual([]);
  });

  it('limites do plano gratuito são aplicados no servidor', async () => {
    const ana = await signUp(ctx, 'Ana');
    const asAna = auth(ana.accessToken);
    const h = await ctx.app.inject({ method: 'POST', url: '/v1/households', headers: asAna, payload: { name: 'Casa' } });
    const householdId = h.json().id as string;

    const second = await ctx.app.inject({ method: 'POST', url: '/v1/households', headers: asAna, payload: { name: 'Outra' } });
    expect(second.statusCode).toBe(402);

    const items = Array.from({ length: 20 }, (_, i) => ({ name: `Item ${i}`, category: 'OTHER' }));
    expect((await ctx.app.inject({ method: 'POST', url: `/v1/households/${householdId}/items/bulk`, headers: asAna, payload: { items } })).statusCode).toBe(201);
    const over = await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/items`,
      headers: asAna,
      payload: { name: 'Mais um', category: 'OTHER' },
    });
    expect(over.statusCode).toBe(402);
  });

  it('excluir conta preserva a contabilidade de quem fica', async () => {
    const ana = await signUp(ctx, 'Ana');
    const beto = await signUp(ctx, 'Beto');
    const h = await ctx.app.inject({ method: 'POST', url: '/v1/households', headers: auth(ana.accessToken), payload: { name: 'Casa' } });
    const householdId = h.json().id as string;
    const inv = await ctx.app.inject({ method: 'POST', url: `/v1/households/${householdId}/invites`, headers: auth(ana.accessToken) });
    await ctx.app.inject({ method: 'POST', url: '/v1/households/join', headers: auth(beto.accessToken), payload: { code: inv.json().code } });
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/households/${householdId}/purchases`,
      headers: auth(ana.accessToken),
      payload: { title: 'Feira', amountCents: 1000, participantIds: [ana.userId, beto.userId] },
    });

    const wrongPw = await ctx.app.inject({ method: 'DELETE', url: '/v1/me', headers: auth(ana.accessToken), payload: { password: 'errada 000' } });
    expect(wrongPw.statusCode).toBe(401);
    const del = await ctx.app.inject({ method: 'DELETE', url: '/v1/me', headers: auth(ana.accessToken), payload: { password: ana.password } });
    expect(del.statusCode).toBe(204);

    const deleted = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ana.userId } });
    expect(deleted.email).not.toBe(ana.email);
    expect(deleted.displayName).toBe('Ex-morador');

    const bal = await ctx.app.inject({ method: 'GET', url: `/v1/households/${householdId}/balances`, headers: auth(beto.accessToken) });
    expect(bal.json().formerMembers).toEqual([{ userId: ana.userId, displayName: 'Ex-morador' }]);
    const hh = await ctx.app.inject({ method: 'GET', url: `/v1/households/${householdId}`, headers: auth(beto.accessToken) });
    expect(hh.json().myRole).toBe('OWNER'); // Beto assumiu a administração

    const old = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(ana.accessToken) });
    expect(old.statusCode).toBe(401);
  });
});
