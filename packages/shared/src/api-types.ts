/**
 * Formato das respostas da API (DTOs). Mantidos aqui para o app consumir com tipagem.
 */
import type { BuyerMode, Category, ItemStatus, Plan, PlanLimits, Role } from './constants';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
}

export interface HouseholdSummaryDTO {
  id: string;
  name: string;
  role: Role;
  plan: Plan;
}

export interface MeDTO {
  user: UserDTO;
  households: HouseholdSummaryDTO[];
}

export interface MemberDTO {
  userId: string;
  displayName: string;
  role: Role;
  joinedAt: string;
}

export interface HouseholdDTO {
  id: string;
  name: string;
  plan: Plan;
  limits: PlanLimits;
  myRole: Role;
  members: MemberDTO[];
  itemCount: number;
}

export interface ItemDTO {
  id: string;
  name: string;
  category: Category;
  unit: string | null;
  critical: boolean;
  status: ItemStatus;
  buyerMode: BuyerMode;
  preferredUserId: string | null;
  typicalPriceCents: number | null;
  lastBuyerId: string | null;
  suggestedBuyerId: string | null;
  statusChangedAt: string;
  statusChangedById: string | null;
  lastPhotoId: string | null;
  updatedAt: string;
}

export interface StatusEventDTO {
  id: string;
  status: ItemStatus;
  userId: string | null;
  note: string | null;
  photoId: string | null;
  createdAt: string;
}

export interface PurchaseDTO {
  id: string;
  itemId: string | null;
  title: string;
  buyerId: string;
  amountCents: number;
  quantity: number;
  note: string | null;
  purchasedAt: string;
  shares: { userId: string; shareCents: number }[];
}

export interface SettlementDTO {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  createdAt: string;
}

export interface BalancesDTO {
  balances: { userId: string; netCents: number }[];
  transfers: { fromUserId: string; toUserId: string; amountCents: number }[];
  /** Nomes de ex-moradores ainda presentes no histórico. */
  formerMembers: { userId: string; displayName: string }[];
}

export interface InviteDTO {
  code: string;
  expiresAt: string;
  maxUses: number;
}

export interface PhotoDTO {
  id: string;
}
