import argon2 from 'argon2';

/**
 * Hash de senhas com Argon2id (vencedor da Password Hashing Competition,
 * recomendado pela OWASP). O salt aleatório é gerado pela biblioteca e fica
 * embutido no hash. O "pepper" é um segredo do servidor que não vive no banco.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB (mínimo OWASP 2024+)
  timeCost: 2,
  parallelism: 1,
} as const;

export class PasswordHasher {
  private readonly secret: Buffer;
  private dummyHash: Promise<string> | null = null;

  constructor(pepper: string) {
    this.secret = Buffer.from(pepper);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { ...OPTIONS, secret: this.secret });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password, { secret: this.secret });
    } catch {
      return false;
    }
  }

  /**
   * Executa uma verificação com custo idêntico quando o usuário não existe,
   * para que o tempo de resposta não revele quais e-mails estão cadastrados.
   */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-safety-0');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
