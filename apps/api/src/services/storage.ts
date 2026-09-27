import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

/**
 * Armazenamento de fotos. As chaves são sempre geradas pelo servidor (UUID),
 * então não há path traversal possível. O diretório é privado: as fotos só saem
 * por uma rota autenticada que confere se a pessoa pertence à casa.
 *
 * Em produção, troque por uma implementação S3/R2 com bucket privado
 * mantendo a mesma interface.
 */
export interface PhotoStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Readable;
  remove(key: string): Promise<void>;
}

const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|heic)$/;

export class LocalPhotoStorage implements PhotoStorage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private resolve(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('Chave de armazenamento inválida');
    return path.join(this.root, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.resolve(key), data, { mode: 0o600, flag: 'wx' });
  }

  get(key: string): Readable {
    return createReadStream(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

/** Identifica o tipo real do arquivo pelos bytes iniciais, ignorando nome e Content-Type do cliente. */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1)$/.test(buf.toString('ascii', 8, 12))) {
    return { mime: 'image/heic', ext: 'heic' };
  }
  return null;
}
