/**
 * Liga tudo para testar no celular com um único comando: `npm run dev`.
 *
 * 1. Prepara o projeto, se for a primeira vez (mesmo que "npm run setup").
 * 2. Liga o banco de dados local e atualiza as tabelas.
 * 3. Liga a API (o servidor do app) e espera ela responder.
 * 4. Liga o Expo, que mostra o QR Code para abrir o app no Expo Go.
 *
 * Para desligar tudo: Ctrl + C.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { API_ENV, DATA_DIR, MOBILE_ENV, ROOT, startDatabase, stopDatabase } from './lib/db.mjs';
import { checkAndWriteConfig, migrate } from './setup.mjs';

const isWindows = process.platform === 'win32';
const children = [];

/**
 * `ownGroup`: o processo ganha um grupo próprio, para que ao desligar a gente encerre
 * também os subprocessos dele (o npm abre outros por baixo). Não serve para o Expo,
 * que precisa ler o teclado do terminal.
 */
function run(command, args, cwd, { env = {}, ownGroup = false } = {}) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: isWindows,
    detached: ownGroup && !isWindows,
    env: { ...process.env, ...env },
  });
  children.push({ child, ownGroup });
  return child;
}

/** Roda o Expo direto pelo Node (sem npx no meio), para o Ctrl + C chegar nele sem intermediários. */
function runExpo(cwd) {
  const cli = path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli');
  const child = spawn(process.execPath, [cli, 'start'], { cwd, stdio: 'inherit' });
  children.push({ child, ownGroup: false });
  return child;
}

function stopChild({ child, ownGroup }) {
  if (child.exitCode !== null || !child.pid) return;
  try {
    if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else if (ownGroup) process.kill(-child.pid, 'SIGINT');
    else child.kill('SIGINT');
  } catch {
    // já tinha saído
  }
}

/** Endereços do computador na rede local (o que o celular usa para chegar até ele). */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function waitForApi(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:3333/health');
      if (res.ok) return true;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n  Desligando...');
  for (const entry of children) stopChild(entry);
  await stopDatabase();
  process.exitCode = code;
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

async function main() {
  console.log('\n  SupplySync: ligando o ambiente de testes\n');

  if (!existsSync(API_ENV) || !existsSync(MOBILE_ENV)) checkAndWriteConfig();

  await startDatabase();
  console.log(`  ✔ Banco de dados ligado (${path.relative(ROOT, DATA_DIR)})`);
  migrate();

  // LOG_LEVEL=warn deixa o terminal limpo: só aparecem avisos, erros e os códigos de e-mail.
  run('npm', ['run', 'dev', '-w', '@supplysync/api'], ROOT, { env: { LOG_LEVEL: 'warn' }, ownGroup: true });
  if (!(await waitForApi())) {
    console.error('\n  ✖ A API não respondeu. Veja a mensagem de erro acima.\n');
    return shutdown(1);
  }

  const ips = lanAddresses();
  console.log('  ✔ API ligada');
  if (ips.length > 0) console.log(`    O celular vai falar com ela em: http://${ips[0]}:3333`);
  console.log('\n  Agora o Expo vai mostrar um QR Code. Escaneie com o celular (veja docs/PRIMEIROS-PASSOS.md).\n');

  const expo = runExpo(path.join(ROOT, 'apps', 'mobile'));
  expo.on('exit', (code) => void shutdown(code ?? 0));
}

main().catch(async (err) => {
  console.error(`\n  ✖ ${err instanceof Error ? err.message : err}\n`);
  await shutdown(1);
});
