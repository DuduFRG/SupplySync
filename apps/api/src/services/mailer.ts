import type { FastifyBaseLogger } from 'fastify';
import nodemailer, { type Transporter } from 'nodemailer';
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

/**
 * SMTP: o jeito gratuito de enviar e-mails sem domínio próprio.
 * - Gmail: smtp.gmail.com, porta 465 ou 587, com "senha de app" (cerca de 500 e-mails por dia).
 * - Brevo: smtp-relay.brevo.com, porta 587 (300 e-mails por dia no plano gratuito).
 * O servidor é definido na configuração, nunca pelo usuário (sem risco de SSRF).
 */
class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    config: { host: string; port: number; user: string; pass: string },
    private readonly from: string,
    private readonly log: FastifyBaseLogger,
  ) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port !== 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      // Somente texto puro: nada de HTML montado com dados do usuário.
      await this.transport.sendMail({ from: this.from, to: message.to, subject: message.subject, text: message.text });
    } catch (err) {
      this.log.error({ err: { message: (err as Error).message } }, 'mail: smtp send failed');
    }
  }
}

/**
 * Desenvolvimento: em vez de enviar o e-mail, mostra no terminal de forma bem visível,
 * para você copiar o código de confirmação. Bloqueado em produção pela configuração.
 */
class ConsoleMailer implements Mailer {
  constructor(private readonly log: FastifyBaseLogger) {}

  async send(message: MailMessage): Promise<void> {
    this.log.debug({ mail: message }, 'mail (dev): mensagem não enviada');
    const code = /\b(\d{6})\b/.exec(message.subject)?.[1];
    const line = '─'.repeat(52);
    process.stdout.write(
      `\n  ${line}\n  E-MAIL (não enviado, modo de teste)\n  Para: ${message.to}\n  ${message.subject}\n` +
        (code ? `\n  >>> CÓDIGO: ${code} <<<\n` : '') +
        `  ${line}\n\n`,
    );
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
  if (config.MAIL_PROVIDER === 'smtp') {
    return new SmtpMailer(
      { host: config.SMTP_HOST!, port: config.SMTP_PORT, user: config.SMTP_USER!, pass: config.SMTP_PASS! },
      config.MAIL_FROM,
      log,
    );
  }
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
  welcome: (name: string): Omit<MailMessage, 'to'> => ({
    subject: 'Sua conta no SupplySync foi criada',
    text: `Olá, ${name}. Boas-vindas ao SupplySync!

Sua conta foi criada com sucesso. A partir de agora, a sua casa tem um lugar para saber o que está acabando, de quem é a vez de comprar e como dividir as contas.

Próximos passos:
1. Crie a sua casa (ou entre com o código de convite que alguém te enviou).
2. Adicione os itens que vocês sempre compram.
3. Convide quem mora com você em Ajustes > Convidar.

Se não foi você que criou esta conta, responda este e-mail que a gente resolve.

Equipe SupplySync`,
  }),
  resetPassword: (code: string): Omit<MailMessage, 'to'> => ({
    subject: `${code} é seu código para redefinir a senha`,
    text: `Recebemos um pedido para redefinir sua senha do SupplySync.\n\nCódigo: ${code} (expira em 15 minutos).\n\nSe não foi você, ignore este e-mail. Sua senha atual continua valendo.`,
  }),
};
