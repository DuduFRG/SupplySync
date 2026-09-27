import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { ApiErrorBody, AuthTokens } from '@supplysync/shared';

export const API_URL: string = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3333';

const REFRESH_KEY = 'ss.refreshToken';
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Tokens:
 * - access token apenas em memória (some quando o app fecha);
 * - refresh token no Keychain (iOS) / Keystore (Android), só neste aparelho e desbloqueado.
 */
let accessToken: string | null = null;
// Na web (pré-visualização) não existe cofre seguro: o refresh token fica só em memória, nunca em localStorage.
let webRefreshToken: string | null = null;
const isWeb = Platform.OS === 'web';
let refreshInFlight: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const tokenStore = {
  getAccessToken: () => accessToken,
  async save(tokens: AuthTokens) {
    accessToken = tokens.accessToken;
    if (isWeb) {
      webRefreshToken = tokens.refreshToken;
      return;
    }
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  getRefreshToken: () => (isWeb ? Promise.resolve(webRefreshToken) : SecureStore.getItemAsync(REFRESH_KEY)),
  async clear() {
    accessToken = null;
    webRefreshToken = null;
    if (!isWeb) await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
  setSessionExpiredHandler(handler: (() => void) | null) {
    onSessionExpired = handler;
  },
};

/** Troca o refresh token por um par novo. Uma única chamada por vez (rotação segura). */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) return false;
      const tokens = await request<AuthTokens>('/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      });
      await tokenStore.save(tokens);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await tokenStore.clear();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, auth = true, retryOnUnauthorized = true } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet.');
  }

  if (response.status === 401 && auth && retryOnUnauthorized) {
    if (await refreshSession()) return request<T>(path, { ...options, retryOnUnauthorized: false });
    onSessionExpired?.();
  }

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(response.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Algo deu errado. Tente novamente.', err?.fields);
  }
  return data as T;
}

/** Cabeçalhos para carregar imagens protegidas (fotos de itens). */
export function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
