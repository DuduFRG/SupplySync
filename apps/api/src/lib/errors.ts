/**
 * Erros de aplicação com mensagem pública controlada.
 * Qualquer erro que não seja AppError vira "Erro interno" para o cliente.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(publicMessage);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message = 'Requisição inválida', fields?: Record<string, string>) =>
    new AppError(400, 'BAD_REQUEST', message, fields),
  unauthorized: (message = 'Sessão expirada. Entre novamente.') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Você não tem permissão para esta ação') => new AppError(403, 'FORBIDDEN', message),
  /** Usado também para recursos de outras casas: não revelamos que existem. */
  notFound: (message = 'Não encontrado') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  planLimit: (message: string) => new AppError(402, 'PLAN_LIMIT', message),
  captcha: () => new AppError(400, 'CAPTCHA_FAILED', 'Não foi possível confirmar que você é uma pessoa. Tente novamente.'),
};
