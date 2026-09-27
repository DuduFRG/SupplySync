import type { Config } from '../config';
import { safeFetch } from '../lib/safe-fetch';

export interface CaptchaVerifier {
  verify(token: string | undefined, ip: string): Promise<boolean>;
}

/** Cloudflare Turnstile: verificação sempre no servidor, com o segredo que nunca sai daqui. */
class TurnstileVerifier implements CaptchaVerifier {
  constructor(private readonly secretKey: string) {}

  async verify(token: string | undefined, ip: string): Promise<boolean> {
    if (!token) return false;
    try {
      const body = new URLSearchParams({ secret: this.secretKey, response: token, remoteip: ip });
      const res = await safeFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body,
        timeoutMs: 5000,
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { success?: unknown };
      return data.success === true;
    } catch {
      // Falha na verificação = bloqueia (fail closed).
      return false;
    }
  }
}

/** Apenas desenvolvimento e testes. A configuração impede este modo em produção. */
class NoopVerifier implements CaptchaVerifier {
  async verify(): Promise<boolean> {
    return true;
  }
}

export function createCaptchaVerifier(config: Config): CaptchaVerifier {
  if (config.CAPTCHA_PROVIDER === 'turnstile') return new TurnstileVerifier(config.TURNSTILE_SECRET_KEY!);
  return new NoopVerifier();
}
