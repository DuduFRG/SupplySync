import type { z } from 'zod';
import { ApiError } from '@/api/client';

export type FieldErrors = Record<string, string>;

/** Valida no aparelho com os mesmos schemas da API: feedback imediato, sem ida à rede. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): { data: z.output<S> } | { errors: FieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    errors[key] ??= issue.message;
  }
  return { errors };
}

/** Converte erro da API em mensagem de tela + erros por campo. */
export function apiErrorToForm(err: unknown): { message: string; fields: FieldErrors } {
  if (err instanceof ApiError) return { message: err.message, fields: err.fields ?? {} };
  return { message: 'Algo deu errado. Tente novamente.', fields: {} };
}
