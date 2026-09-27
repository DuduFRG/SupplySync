import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config';
import { safeFetch } from '../lib/safe-fetch';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  async send(message: MailMessage): Promise<void> {
    try {
      const res = await safeFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        // Somente texto puro: nada de HTML montado com dados do usuário.
        body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!res.ok) this.log.error({ status: res.status }, 'mail: provider rejected message');
    } catch (err) {
      this.log.error({ err }, 'mail: send failed');
    }
  }
}

/** Desenvolvimento: imprime o e-mail no log local. Bloqueado em produção pela configuração. */
class ConsoleMailer implements Mailer {
  constructor(private readonly log: FastifyBaseLogger) {}

  async send(message: MailMessage): Promise<void> {
    this.log.info({ mail: message }, 'mail (dev): mensagem não enviada, exibida no log');
  }
}

/** Em testes, guarda as mensagens para inspeção. */
export class MemoryMailer implements Mailer {
  readonly outbox: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }
}

export function createMailer(config: Config, log: FastifyBaseLogger): Mailer {
  if (config.MAIL_PROVIDER === 'resend') return new ResendMailer(config.RESEND_API_KEY!, config.MAIL_FROM, log);
  return new ConsoleMailer(log);
}

export const MailTemplates = {
  verifyEmail: (name: string, code: string): Omit<MailMessage, 'to'> => ({
    subject: `${code} é seu código do SupplySync`,
    text: `Olá, ${name}.\n\nSeu código de confirmação é ${code}. Ele expira em 15 minutos.\n\nSe você não criou uma conta no SupplySync, ignore este e-mail.`,
  }),
  alreadyRegistered: (): Omit<MailMessage, 'to'> => ({
    subject: 'Tentativa de cadastro no SupplySync',
    text: 'Alguém tentou criar uma conta no SupplySync com este e-mail, que já está cadastrado.\n\nSe foi você, basta entrar com sua senha ou usar "Esqueci minha senha". Se não foi, nenhuma ação é necessária.',
  }),
  resetPassword: (code: string): Omit<MailMessage, 'to'> => ({
    subject: `${code} é seu código para redefinir a senha`,
    text: `Recebemos um pedido para redefinir sua senha do SupplySync.\n\nCódigo: ${code} (expira em 15 minutos).\n\nSe não foi você, ignore este e-mail. Sua senha atual continua valendo.`,
  }),
};
