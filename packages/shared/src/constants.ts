/**
 * Constantes de produto compartilhadas. A API é a fonte de verdade para limites:
 * o app usa estes valores apenas para exibição e validação antecipada.
 */

export const ITEM_STATUSES = ['OK', 'LOW', 'OUT'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const BUYER_MODES = ['ROTATION', 'PREFERRED', 'FAIR'] as const;
export type BuyerMode = (typeof BUYER_MODES)[number];

export const CATEGORIES = ['CLEANING', 'HYGIENE', 'KITCHEN', 'PET', 'BABY', 'HOME', 'OTHER'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLANS = ['FREE', 'FAMILY'] as const;
export type Plan = (typeof PLANS)[number];

export const ROLES = ['OWNER', 'MEMBER'] as const;
export type Role = (typeof ROLES)[number];

export interface PlanLimits {
  maxMembers: number;
  maxItems: number;
  /** Janela de histórico visível de compras, em dias. */
  historyDays: number;
  /** Quantas casas um usuário pode integrar neste plano. */
  maxHouseholdsPerUser: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { maxMembers: 4, maxItems: 20, historyDays: 60, maxHouseholdsPerUser: 1 },
  FAMILY: { maxMembers: 8, maxItems: 300, historyDays: 3650, maxHouseholdsPerUser: 3 },
};

/** Faixa de preço de referência da assinatura familiar (exibição). */
export const FAMILY_PRICE_RANGE_BRL = { min: 19, max: 39 } as const;

/** Maior valor aceito em uma compra: R$ 50.000,00. */
export const MAX_AMOUNT_CENTS = 5_000_000;

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_DAYS = 7;
export const INVITE_MAX_USES = 5;

export const EMAIL_CODE_TTL_MINUTES = 15;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
