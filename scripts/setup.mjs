/**
 * Prepara o projeto para rodar no seu computador. Rode uma vez: `npm run setup`.
 *
 * O que ele faz:
 * 1. Confere a versão do Node.js.
 * 2. Cria os arquivos de configuração (.env) com senhas internas geradas na hora.
 * 3. Cria o banco de dados local e as tabelas do app.
 *
 * Pode rodar de novo sem medo: nada que já existe é sobrescrito.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_ENV, DB_NAME, MOBILE_ENV, ROOT, readEnvFile, startDatabase, stopDatabase } from './lib/db.mjs';

const ok = (msg) => console.log(`  ✔ ${msg}`);
const secret = () => randomBytes(48).toString('base64url');
const DB_PORT = 54329;

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    console.error(`\n  ✖ Seu Node.js é a versão ${process.versions.node}. O SupplySync precisa da 22.12 ou mais nova.`);
    console.error('    Baixe a versão "LTS" em https://nodejs.org e rode este comando de novo.\n');
    process.exit(1);
  }
  ok(`Node.js ${process.versions.node}`);
}

function writeApiEnv() {
  if (existsSync(API_ENV)) return ok('Configuração da API já existia (mantida)');
  const dbPassword = randomBytes(18).toString('hex');
  writeFileSync(
    API_ENV,
    `# Gerado por "npm run setup" para DESENVOLVIMENTO. Nunca envie este arquivo para o GitHub.
NODE_ENV=development
# 0.0.0.0 permite que o celular, na mesma rede Wi-Fi, converse com a API.
HOST=0.0.0.0
PORT=3333
LOG_LEVEL=info

DATABASE_URL=postgresql://supplysync:${dbPassword}@127.0.0.1:${DB_PORT}/${DB_NAME}?schema=public

JWT_ACCESS_SECRET=${secret()}
TOKEN_HASH_SECRET=${secret()}
PASSWORD_PEPPER=${secret()}

TRUST_PROXY_HOPS=0
CORS_ORIGINS=
REDIS_URL=
CAPTCHA_PROVIDER=none
TURNSTILE_SECRET_KEY=
MAIL_PROVIDER=console
RESEND_API_KEY=
MAIL_FROM="SupplySync <no-reply@supplysync.app>"
STORAGE_DIR=./storage
EXPO_ACCESS_TOKEN=
`,
    { mode: 0o600 },
  );
  ok('Configuração da API criada, com senhas internas novas');
}

function writeMobileEnv() {
  if (existsSync(MOBILE_ENV)) return ok('Configuração do app já existia (mantida)');
  writeFileSync(
    MOBILE_ENV,
    `# Gerado por "npm run setup". Somente valores PÚBLICOS: tudo aqui vai para dentro do app.
# Deixe EXPO_PUBLIC_API_URL vazio: em desenvolvimento o app descobre sozinho o endereço do seu computador.
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_TURNSTILE_SITE_KEY=
EXPO_PUBLIC_TURNSTILE_BASE_URL=
`,
  );
  ok('Configuração do app criada');
}

export function migrate() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.join(ROOT, 'apps', 'api'),
    stdio: 'pipe',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: readEnvFile(API_ENV).DATABASE_URL },
  });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    throw new Error('Não foi possível criar as tabelas do banco');
  }
  ok('Tabelas do banco criadas e atualizadas');
}

export function checkAndWriteConfig() {
  checkNode();
  writeApiEnv();
  writeMobileEnv();
}

export async function setup() {
  console.log('\n  Preparando o SupplySync...\n');
  checkAndWriteConfig();
  await startDatabase();
  ok('Banco de dados local ligado');
  migrate();
  await stopDatabase();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup()
    .then(() => {
      console.log('\n  Tudo pronto. Agora rode:  npm run dev\n');
    })
    .catch(async (err) => {
      await stopDatabase();
      console.error(`\n  ✖ ${err instanceof Error ? err.message : err}\n`);
      process.exitCode = 1;
    });
}
