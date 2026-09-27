import { describe, expect, it } from 'vitest';
import {
  cleanText,
  itemCreateSchema,
  joinHouseholdSchema,
  passwordSchema,
  purchaseCreateSchema,
  registerSchema,
} from '../src';

describe('cleanText', () => {
  it('remove marcação, controles, bidi e prefixos de fórmula', () => {
    expect(cleanText('  <script>alert(1)</script> Sabão ')).toBe('scriptalert(1)/script Sabão');
    expect(cleanText('Papel\u0000‮higiênico')).toBe('Papel higiênico');
    expect(cleanText('=HYPERLINK("x")')).toBe('HYPERLINK("x")');
    expect(cleanText('Café')).toBe('Café');
  });
});

describe('schemas', () => {
  it('rejeita chaves desconhecidas (mass assignment)', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'umaSenhaForte9',
      displayName: 'Ana',
      role: 'ADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('normaliza e-mail', () => {
    const r = registerSchema.parse({ email: '  Ana@Exemplo.COM ', password: 'umaSenhaForte9', displayName: 'Ana' });
    expect(r.email).toBe('ana@exemplo.com');
  });

  it('política de senha', () => {
    expect(passwordSchema.safeParse('curta1').success).toBe(false);
    expect(passwordSchema.safeParse('aaaaaaaaaaaa').success).toBe(false);
    expect(passwordSchema.safeParse('somenteletras').success).toBe(false);
    expect(passwordSchema.safeParse('casa verde 2026').success).toBe(true);
  });

  it('item sanitizado e com padrões', () => {
    const item = itemCreateSchema.parse({ name: ' <b>Ração</b> ', category: 'PET' });
    expect(item).toMatchObject({ name: 'bRação/b', critical: false, buyerMode: 'ROTATION', preferredUserId: null });
    expect(itemCreateSchema.safeParse({ name: '   ', category: 'PET' }).success).toBe(false);
    expect(itemCreateSchema.safeParse({ name: 'x', category: 'DROP TABLE' }).success).toBe(false);
  });

  it('código de convite normalizado', () => {
    expect(joinHouseholdSchema.parse({ code: 'abcd-efgh' }).code).toBe('ABCDEFGH');
    expect(joinHouseholdSchema.safeParse({ code: 'ABCD1OIO' }).success).toBe(false);
  });

  it('compra exige descrição quando não há item', () => {
    const base = { amountCents: 1000, participantIds: ['a0000000-0000-4000-8000-000000000001'] };
    expect(purchaseCreateSchema.safeParse(base).success).toBe(false);
    expect(purchaseCreateSchema.safeParse({ ...base, title: 'Feira' }).success).toBe(true);
    expect(purchaseCreateSchema.safeParse({ ...base, title: 'Feira', amountCents: 10.5 }).success).toBe(false);
  });
});
