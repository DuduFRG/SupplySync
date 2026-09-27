import type { z } from 'zod';
import { Errors } from './errors';

/**
 * Faz parse estrito de qualquer entrada (body, params, query).
 * Em caso de erro, devolve mensagens por campo sem ecoar o valor recebido.
 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    // Chaves desconhecidas ou tipos errados recebem mensagem genérica.
    const message = issue.code === 'unrecognized_keys' ? 'Campo não permitido' : issue.message;
    if (!fields[key]) fields[key] = message;
  }
  throw Errors.badRequest('Confira os dados enviados', fields);
}
