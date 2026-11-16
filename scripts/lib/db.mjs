/**
 * Banco de dados de desenvolvimento, sem Docker.
 *
 * Usa o pacote embedded-postgres, que traz um PostgreSQL de verdade já compilado
 * para Windows, macOS e Linux. Os dados ficam em `.data/postgres`, dentro do
 * projeto (fora do Git). Só para desenvolvimento: em produção use um banco gerenciado.
 */
import { existsSync, readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const DATA_DIR = path.join(ROOT, '.data', 'postgres');
export const API_ENV = path.join(ROOT, 'apps', 'api', '.env');
export const MOBILE_ENV = path.join(ROOT, 'apps', 'mobile', '.env');
export const DB_NAME = 'supplysync';

/** Lê um arquivo .env simples (CHAVE=valor) sem dependências. */
export function readEnvFile(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

/** Extrai porta, usuário e senha da DATABASE_URL gravada pelo setup. */
function connectionFromEnv() {
  const url = new URL(readEnvFile(API_ENV).DATABASE_URL);
  return {
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

let instance = null;

/** Liga o banco (criando na primeira vez) e garante que a base do app existe. */
export async function startDatabase() {
  const { port, user, password } = connectionFromEnv();
  const firstRun = !existsSync(path.join(DATA_DIR, 'PG_VERSION'));

  instance = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port,
    user,
    password,
    persistent: true,
    authMethod: 'scram-sha-256',
    // O PostgreSQL não roda como administrador (root); só acontece em contêineres.
    createPostgresUser: userInfo().uid === 0,
    onLog: () => {},
    onError: (err) => {
      const text = String(err);
      if (/error|fatal/i.test(text)) console.error(`  [banco] ${text.trim()}`);
    },
  });

  if (firstRun) await instance.initialise();
  await instance.start();
  if (firstRun) await instance.createDatabase(DB_NAME);
  return instance;
}

export async function stopDatabase() {
  if (!instance) return;
  const current = instance;
  instance = null;
  await current.stop().catch(() => {});
}
