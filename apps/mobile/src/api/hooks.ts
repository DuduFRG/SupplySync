import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import type {
  AuthTokens,
  BalancesDTO,
  HouseholdDTO,
  InviteDTO,
  ItemCreateInput,
  ItemDTO,
  ItemStatus,
  ItemUpdateInput,
  MeDTO,
  PhotoDTO,
  PurchaseDTO,
  StatusEventDTO,
} from '@supplysync/shared';
import { useSession } from '@/auth/AuthProvider';
import { request } from './client';

export const qk = {
  me: ['me'] as const,
  household: (id: string) => ['household', id] as const,
  items: (id: string) => ['household', id, 'items'] as const,
  events: (id: string, itemId: string) => ['household', id, 'items', itemId, 'events'] as const,
  balances: (id: string) => ['household', id, 'balances'] as const,
  purchases: (id: string) => ['household', id, 'purchases'] as const,
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function useMe() {
  const { status } = useSession();
  return useQuery({ queryKey: qk.me, queryFn: () => request<MeDTO>('/v1/me'), enabled: status === 'signedIn' });
}

/** Casa ativa: a escolhida pela pessoa, ou a primeira da lista. */
export function useActiveHouseholdId(): string | null {
  const { activeHouseholdId } = useSession();
  const { data } = useMe();
  if (!data) return null;
  if (activeHouseholdId && data.households.some((h) => h.id === activeHouseholdId)) return activeHouseholdId;
  return data.households[0]?.id ?? null;
}

export function useHousehold(householdId: string | null) {
  return useQuery({
    queryKey: qk.household(householdId ?? '-'),
    queryFn: () => request<HouseholdDTO>(`/v1/households/${householdId}`),
    enabled: !!householdId,
  });
}

export function useItems(householdId: string | null) {
  return useQuery({
    queryKey: qk.items(householdId ?? '-'),
    queryFn: async () => (await request<{ items: ItemDTO[] }>(`/v1/households/${householdId}/items`)).items,
    enabled: !!householdId,
    // O inventário muda pelas mãos de outras pessoas: dados curtos e atualização periódica com o app aberto.
    staleTime: 5_000,
    refetchInterval: 30_000,
  });
}

export function useItemEvents(householdId: string | null, itemId: string) {
  return useQuery({
    queryKey: qk.events(householdId ?? '-', itemId),
    queryFn: async () =>
      (await request<{ events: StatusEventDTO[] }>(`/v1/households/${householdId}/items/${itemId}/events`)).events,
    enabled: !!householdId,
  });
}

export function useBalances(householdId: string | null) {
  return useQuery({
    queryKey: qk.balances(householdId ?? '-'),
    queryFn: () => request<BalancesDTO>(`/v1/households/${householdId}/balances`),
    enabled: !!householdId,
  });
}

interface PurchasePage {
  purchases: PurchaseDTO[];
  nextCursor: string | null;
  historyDays: number;
}

export function usePurchases(householdId: string | null) {
  return useInfiniteQuery({
    queryKey: qk.purchases(householdId ?? '-'),
    queryFn: ({ pageParam }) =>
      request<PurchasePage>(
        `/v1/households/${householdId}/purchases?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!householdId,
  });
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

function useInvalidateHousehold(householdId: string | null) {
  const qc = useQueryClient();
  return () => {
    if (householdId) void qc.invalidateQueries({ queryKey: ['household', householdId] });
  };
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  const { setActiveHousehold } = useSession();
  return useMutation({
    mutationFn: (name: string) => request<HouseholdDTO>('/v1/households', { method: 'POST', body: { name } }),
    onSuccess: async (h) => {
      await setActiveHousehold(h.id);
      qc.setQueryData(qk.household(h.id), h);
      await qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useJoinHousehold() {
  const qc = useQueryClient();
  const { setActiveHousehold } = useSession();
  return useMutation({
    mutationFn: (code: string) => request<HouseholdDTO>('/v1/households/join', { method: 'POST', body: { code } }),
    onSuccess: async (h) => {
      await setActiveHousehold(h.id);
      qc.setQueryData(qk.household(h.id), h);
      await qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useRenameHousehold(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => request<HouseholdDTO>(`/v1/households/${householdId}`, { method: 'PATCH', body: { name } }),
    onSuccess: (h) => {
      qc.setQueryData(qk.household(h.id), h);
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useCreateInvite(householdId: string | null) {
  return useMutation({
    mutationFn: () => request<InviteDTO>(`/v1/households/${householdId}/invites`, { method: 'POST' }),
  });
}

export function useLeaveHousehold(householdId: string | null) {
  const qc = useQueryClient();
  const { setActiveHousehold } = useSession();
  return useMutation({
    mutationFn: () => request<void>(`/v1/households/${householdId}/members/me`, { method: 'DELETE' }),
    onSuccess: async () => {
      await setActiveHousehold(null);
      qc.removeQueries({ queryKey: ['household', householdId] });
      await qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useRemoveMember(householdId: string | null) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (userId: string) => request<void>(`/v1/households/${householdId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreateItem(householdId: string | null) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (input: Partial<ItemCreateInput> & Pick<ItemCreateInput, 'name' | 'category'>) =>
      request<ItemDTO>(`/v1/households/${householdId}/items`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useBulkCreateItems(householdId: string | null) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (items: Pick<ItemCreateInput, 'name' | 'category' | 'critical'>[]) =>
      request<{ created: number }>(`/v1/households/${householdId}/items/bulk`, { method: 'POST', body: { items } }),
    onSuccess: invalidate,
  });
}

export function useUpdateItem(householdId: string | null, itemId: string) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (input: ItemUpdateInput) =>
      request<ItemDTO>(`/v1/households/${householdId}/items/${itemId}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useArchiveItem(householdId: string | null) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (itemId: string) => request<void>(`/v1/households/${householdId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Sinalização com atualização otimista: o toque responde na hora, mesmo com rede lenta. */
export function useReportStatus(householdId: string | null) {
  const qc = useQueryClient();
  const key = qk.items(householdId ?? '-');
  return useMutation({
    mutationFn: (input: { itemId: string; status: ItemStatus; note?: string; photoId?: string }) =>
      request<ItemDTO>(`/v1/households/${householdId}/items/${input.itemId}/status`, {
        method: 'POST',
        body: { status: input.status, note: input.note, photoId: input.photoId },
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ItemDTO[]>(key);
      qc.setQueryData<ItemDTO[]>(key, (items) =>
        items?.map((i) => (i.id === input.itemId ? { ...i, status: input.status, statusChangedAt: new Date().toISOString() } : i)),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['household', householdId] });
    },
  });
}

export function useUploadPhoto(householdId: string | null) {
  return useMutation({
    mutationFn: async (uri: string) => {
      // Reprocessa a imagem no aparelho: reduz tamanho e remove metadados EXIF (inclusive localização GPS).
      const processed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const form = new FormData();
      form.append('file', { uri: processed.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
      return request<PhotoDTO>(`/v1/households/${householdId}/photos`, { method: 'POST', formData: form });
    },
  });
}

export function useCreatePurchase(householdId: string | null) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (input: {
      itemId: string | null;
      title: string | null;
      amountCents: number;
      participantIds: string[];
      buyerId?: string;
      note?: string;
    }) => request<PurchaseDTO>(`/v1/households/${householdId}/purchases`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useCreateSettlement(householdId: string | null) {
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: (input: { fromUserId: string; toUserId: string; amountCents: number }) =>
      request(`/v1/households/${householdId}/settlements`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => request('/v1/me', { method: 'PATCH', body: { displayName } }),
    onSuccess: () => void qc.invalidateQueries(),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => request<void>('/v1/me', { method: 'DELETE', body: { password } }),
  });
}

// Autenticação (sem sessão)
export const authApi = {
  register: (body: { email: string; password: string; displayName: string; captchaToken?: string }) =>
    request<{ message: string }>('/v1/auth/register', { method: 'POST', body, auth: false }),
  verifyEmail: (body: { email: string; code: string }) =>
    request<AuthTokens>('/v1/auth/verify-email', { method: 'POST', body, auth: false }),
  resendCode: (body: { email: string; captchaToken?: string }) =>
    request<{ message: string }>('/v1/auth/resend-code', { method: 'POST', body, auth: false }),
  login: (body: { email: string; password: string; captchaToken?: string }) =>
    request<AuthTokens>('/v1/auth/login', { method: 'POST', body, auth: false }),
  forgotPassword: (body: { email: string; captchaToken?: string }) =>
    request<{ message: string }>('/v1/auth/forgot-password', { method: 'POST', body, auth: false }),
  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    request<AuthTokens>('/v1/auth/reset-password', { method: 'POST', body, auth: false }),
};
