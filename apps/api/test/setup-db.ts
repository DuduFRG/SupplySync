import { execSync } from 'node:child_process';

/** Banco descartável dos testes. Padrão: o do docker-compose (infra/postgres-init.sql). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://supplysync:supplysync_dev_only@127.0.0.1:5432/supplysync_test?schema=public';

/** Aplica as migrações antes da suíte. Recusa bancos que não parecem ser de teste. */
export default function setup() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.includes('test')) {
    throw new Error(`TEST_DATABASE_URL precisa apontar para um banco de teste (nome atual: "${dbName}")`);
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
