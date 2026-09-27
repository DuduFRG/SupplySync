/**
 * Schemas de entrada. São a única porta para dados vindos do cliente:
 * a API faz parse estrito (objetos com chaves extras são rejeitados) e o app
 * reutiliza os mesmos schemas para validar formulários antes do envio.
 */
import { z } from 'zod';
import {
  BUYER_MODES,
  CATEGORIES,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  ITEM_STATUSES,
  MAX_AMOUNT_CENTS,
} from './constants';
import { cleanText, digitsOnly, normalizeInviteCode } from './sanitize';

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

/** Texto livre sanitizado com limites de tamanho aplicados após a limpeza. */
export const safeText = (min: number, max: number, label = 'Campo') =>
  z
    .string({ message: `${label} é obrigatório` })
    .max(max * 4, `${label} muito longo`) // corta payloads gigantes antes de normalizar
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} é obrigatório` : `${label} precisa de ao menos ${min} caracteres`)
        .max(max, `${label} deve ter no máximo ${max} caracteres`),
    );

export const idSchema = z.uuid({ message: 'Identificador inválido' });

export const emailSchema = z
  .string({ message: 'Informe seu e-mail' })
  .max(254, 'E-mail muito longo')
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email({ message: 'E-mail inválido' }));

// Lista curta das senhas mais comuns em vazamentos no Brasil e no mundo.
// A API pode complementar com uma verificação k-anonymity (HIBP) no futuro.
const COMMON_PASSWORDS = new Set([
  '1234567890',
  '12345678910',
  'qwertyuiop',
  'senha12345',
  'password123',
  'brasil2024',
  'brasil2025',
  'brasil2026',
  'abcdef1234',
  '0987654321',
  'iloveyou123',
  'supplysync',
  'supplysync1',
]);

export const passwordSchema = z
  .string({ message: 'Informe uma senha' })
  .min(10, 'Use ao menos 10 caracteres')
  .max(128, 'Use no máximo 128 caracteres')
  .refine((v) => !/^(.)\1+$/.test(v), 'Senha muito previsível')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'Essa senha é muito comum')
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v), 'Combine letras e números');

/** No login não revelamos regras de senha: só limites para evitar abuso. */
const loginPasswordSchema = z.string({ message: 'Informe sua senha' }).min(1, 'Informe sua senha').max(128);

const captchaTokenSchema = z.string().max(4096).optional();

export const emailCodeSchema = z
  .string({ message: 'Informe o código' })
  .transform(digitsOnly)
  .pipe(z.string().length(6, 'O código tem 6 dígitos'));

export const displayNameSchema = safeText(2, 40, 'Nome');

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  captchaToken: captchaTokenSchema,
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
  captchaToken: captchaTokenSchema,
});

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  code: emailCodeSchema,
});

export const emailOnlySchema = z.strictObject({
  email: emailSchema,
  captchaToken: captchaTokenSchema,
});

export const resetPasswordSchema = z.strictObject({
  email: emailSchema,
  code: emailCodeSchema,
  newPassword: passwordSchema,
});

export const refreshSchema = z.strictObject({
  refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Sessão inválida'),
});

// ---------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------

export const updateMeSchema = z.strictObject({
  displayName: displayNameSchema,
});

export const deleteMeSchema = z.strictObject({
  password: loginPasswordSchema,
});

export const pushTokenSchema = z.strictObject({
  token: z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/, 'Token de notificação inválido'),
  platform: z.enum(['ios', 'android']),
});

// ---------------------------------------------------------------------------
// Casas
// ---------------------------------------------------------------------------

export const householdNameSchema = safeText(2, 40, 'Nome da casa');

export const createHouseholdSchema = z.strictObject({
  name: householdNameSchema,
});

export const updateHouseholdSchema = createHouseholdSchema;

const inviteCodeRegex = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

export const joinHouseholdSchema = z.strictObject({
  code: z
    .string({ message: 'Informe o código do convite' })
    .max(32)
    .transform(normalizeInviteCode)
    .pipe(z.string().regex(inviteCodeRegex, 'Código de convite inválido')),
});

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

const priceCentsSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS);

export const itemCreateSchema = z.strictObject({
  name: safeText(1, 40, 'Nome do item'),
  category: z.enum(CATEGORIES),
  critical: z.boolean().default(false),
  buyerMode: z.enum(BUYER_MODES).default('ROTATION'),
  preferredUserId: idSchema.nullable().default(null),
  unit: safeText(1, 20, 'Unidade').nullable().default(null),
  typicalPriceCents: priceCentsSchema.nullable().default(null),
});

export const itemBulkCreateSchema = z.strictObject({
  items: z.array(itemCreateSchema).min(1).max(20),
});

export const itemUpdateSchema = z
  .strictObject({
    name: safeText(1, 40, 'Nome do item'),
    category: z.enum(CATEGORIES),
    critical: z.boolean(),
    buyerMode: z.enum(BUYER_MODES),
    preferredUserId: idSchema.nullable(),
    unit: safeText(1, 20, 'Unidade').nullable(),
    typicalPriceCents: priceCentsSchema.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nada para atualizar');

export const reportStatusSchema = z.strictObject({
  status: z.enum(ITEM_STATUSES),
  note: safeText(1, 140, 'Observação').optional(),
  photoId: idSchema.optional(),
});

// ---------------------------------------------------------------------------
// Compras e acertos
// ---------------------------------------------------------------------------

export const purchaseCreateSchema = z
  .strictObject({
    itemId: idSchema.nullable().default(null),
    /** Obrigatório quando não há item: descreve a compra avulsa. */
    title: safeText(1, 60, 'Descrição').nullable().default(null),
    amountCents: z.number().int().min(1, 'Informe o valor').max(MAX_AMOUNT_CENTS, 'Valor muito alto'),
    quantity: z.number().int().min(1).max(99).default(1),
    /** Quem pagou. Se ausente, é quem está registrando. */
    buyerId: idSchema.optional(),
    participantIds: z
      .array(idSchema)
      .min(1, 'Selecione quem divide')
      .max(8)
      .refine((ids) => new Set(ids).size === ids.length, 'Participantes repetidos'),
    note: safeText(1, 140, 'Observação').optional(),
  })
  .refine((v) => v.itemId !== null || v.title !== null, {
    message: 'Descreva a compra',
    path: ['title'],
  });

export const settlementCreateSchema = z
  .strictObject({
    fromUserId: idSchema,
    toUserId: idSchema,
    amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS),
  })
  .refine((v) => v.fromUserId !== v.toUserId, 'Pagador e recebedor precisam ser diferentes');

export const paginationSchema = z.strictObject({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;
export type ReportStatusInput = z.infer<typeof reportStatusSchema>;
export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
export type SettlementCreateInput = z.infer<typeof settlementCreateSchema>;
