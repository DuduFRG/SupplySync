import { createHash, timingSafeEqual } from 'node:crypto';
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from 'jose';
import type { SocialProvider } from '@supplysync/shared';
import type { Config } from '../config';
import { AppError } from '../lib/errors';
import { safeFetch } from '../lib/safe-fetch';

/**
 * Login com Google e Apple.
 *
 * O app faz o login direto com o Google/Apple e recebe um "token de identidade"
 * (um JWT assinado por eles). A API nunca confia no que o app diz: ela confere
 * a assinatura com as chaves públicas do provedor, o emissor, o destinatário
 * (o nosso app), a validade e, na Apple, o nonce contra reaproveitamento.
 */
export interface SocialIdentity {
  provider: SocialProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

interface ProviderSpec {
  issuers: string[];
  jwksUrl: string;
}

const PROVIDERS: Record<SocialProvider, ProviderSpec> = {
  google: { issuers: ['https://accounts.google.com', 'accounts.google.com'], jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs' },
  apple: { issuers: ['https://appleid.apple.com'], jwksUrl: 'https://appleid.apple.com/auth/keys' },
};

const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFRESH_MS = 60 * 1000;

export type JwksFetcher = (url: string) => Promise<JSONWebKeySet>;

const defaultFetcher: JwksFetcher = async (url) => {
  const res = await safeFetch(url, { timeoutMs: 5000 });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  return (await res.json()) as JSONWebKeySet;
};

const invalid = () => new AppError(401, 'SOCIAL_LOGIN_INVALID', 'Não foi possível confirmar seu login. Tente de novo.');

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true';
}

export class SocialVerifier {
  private readonly audiences: Record<SocialProvider, string[]>;
  private readonly cache = new Map<string, { keys: ReturnType<typeof createLocalJWKSet>; fetchedAt: number }>();

  constructor(
    config: Pick<Config, 'GOOGLE_CLIENT_IDS' | 'APPLE_CLIENT_IDS'>,
    private readonly fetchJwks: JwksFetcher = defaultFetcher,
  ) {
    this.audiences = { google: config.GOOGLE_CLIENT_IDS, apple: config.APPLE_CLIENT_IDS };
  }

  isEnabled(provider: SocialProvider): boolean {
    return this.audiences[provider].length > 0;
  }

  private async keySet(provider: SocialProvider, forceRefresh = false) {
    const { jwksUrl } = PROVIDERS[provider];
    const cached = this.cache.get(jwksUrl);
    const age = cached ? Date.now() - cached.fetchedAt : Infinity;
    if (cached && age < JWKS_TTL_MS && !(forceRefresh && age > JWKS_MIN_REFRESH_MS)) return cached.keys;
    const keys = createLocalJWKSet(await this.fetchJwks(jwksUrl));
    this.cache.set(jwksUrl, { keys, fetchedAt: Date.now() });
    return keys;
  }

  private async verifyJwt(provider: SocialProvider, token: string): Promise<JWTPayload> {
    const options = {
      issuer: PROVIDERS[provider].issuers,
      audience: this.audiences[provider],
      algorithms: ['RS256'],
      clockTolerance: 30,
      maxTokenAge: '1h',
    };
    try {
      return (await jwtVerify(token, await this.keySet(provider), options)).payload;
    } catch (err) {
      // Chave nova do provedor (rotação): busca as chaves de novo uma vez.
      if ((err as { code?: string }).code === 'ERR_JWKS_NO_MATCHING_KEY') {
        return (await jwtVerify(token, await this.keySet(provider, true), options)).payload;
      }
      throw err;
    }
  }

  async verify(provider: SocialProvider, idToken: string, rawNonce?: string): Promise<SocialIdentity> {
    if (!this.isEnabled(provider)) {
      throw new AppError(400, 'SOCIAL_LOGIN_UNAVAILABLE', 'Este tipo de login ainda não está disponível.');
    }

    let payload: JWTPayload;
    try {
      payload = await this.verifyJwt(provider, idToken);
    } catch {
      throw invalid();
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 255) throw invalid();

    if (provider === 'apple') {
      // O app gera um valor aleatório, envia o hash dele para a Apple e o valor original para nós.
      const tokenNonce = payload.nonce;
      if (typeof tokenNonce !== 'string' || !rawNonce || !safeEqual(tokenNonce, sha256Hex(rawNonce))) throw invalid();
    }

    const email = typeof payload.email === 'string' && payload.email.length <= 254 ? payload.email.trim().toLowerCase() : null;
    const name = typeof payload.name === 'string' ? payload.name : null;

    return { provider, subject: payload.sub, email, emailVerified: !!email && asBool(payload.email_verified), name };
  }
}
