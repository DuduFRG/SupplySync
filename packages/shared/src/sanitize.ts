/**
 * Sanitização de texto livre.
 *
 * Tudo que o usuário digita é tratado como texto puro, nunca como HTML. Mesmo
 * assim, normalizamos e removemos caracteres perigosos na entrada para que
 * nenhum consumidor futuro (painel web, e-mail, exportação CSV) herde payloads.
 */

// Caracteres de controle C0/C1, exceto espaço comum. Inclui \u0000 que quebra o Postgres.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
// Controles bidirecionais usados em ataques de "Trojan Source" e spoofing visual.
const BIDI_CHARS = /[‪-‮⁦-⁩‎‏]/g;
// Zero-width, exceto ZWJ (‍) que compõe emojis.
const ZERO_WIDTH = /[​‌⁠﻿]/g;
// Sinais de marcação HTML. Não existe motivo legítimo para eles em nomes de itens ou casas.
const MARKUP_CHARS = /[<>]/g;
// Prefixos que planilhas interpretam como fórmula (CSV injection) quando no início do texto.
const FORMULA_PREFIX = /^[=+\-@\t\r]+/;

export function cleanText(input: string): string {
  return input
    .normalize('NFC')
    .replace(CONTROL_CHARS, ' ')
    .replace(BIDI_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(MARKUP_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FORMULA_PREFIX, '')
    .trim();
}

/** Remove tudo que não for dígito. Útil para códigos numéricos colados com espaços. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/** Normaliza código de convite: maiúsculas, sem espaços nem hífens. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, '');
}
