/**
 * Único ponto de saída HTTP da API (defesa contra SSRF).
 *
 * - Apenas hosts de uma allowlist fixa, definida em código.
 * - Apenas HTTPS na porta padrão.
 * - Sem seguir redirects (um redirect poderia apontar para a rede interna).
 * - Timeout curto e limite de tamanho de resposta.
 *
 * Nenhuma rota aceita URL vinda do usuário. Se isso um dia for necessário,
 * o destino deve passar por aqui e ter o IP resolvido validado contra faixas privadas.
 */
const ALLOWED_HOSTS = new Set([
  'challenges.cloudflare.com', // Turnstile
  'api.resend.com', // e-mail transacional
  'exp.host', // Expo Push
]);

const MAX_RESPONSE_BYTES = 256 * 1024;

export class OutboundBlockedError extends Error {}

export async function safeFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.port !== '' || !ALLOWED_HOSTS.has(target.hostname)) {
    throw new OutboundBlockedError(`Destino não permitido: ${target.hostname}`);
  }
  if (target.username || target.password) {
    throw new OutboundBlockedError('Credenciais na URL não são permitidas');
  }

  const { timeoutMs = 8000, ...rest } = init;
  const response = await fetch(target, {
    ...rest,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_RESPONSE_BYTES) {
    throw new OutboundBlockedError('Resposta grande demais');
  }
  return response;
}
