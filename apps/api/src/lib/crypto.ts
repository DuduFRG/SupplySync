import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '@supplysync/shared';

/**
 * HMAC-SHA256 com segredo do servidor. Usado para guardar tokens de sessão,
 * códigos de e-mail e convites: um vazamento do banco não permite reutilizá-los
 * nem testar os 1.000.000 de códigos possíveis offline.
 */
export function keyedHash(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 256 bits aleatórios em base64url (43 caracteres). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function randomNumericCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += randomInt(0, 10).toString();
  return code;
}

export function randomInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
