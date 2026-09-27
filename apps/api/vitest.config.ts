import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Os testes de integração compartilham um banco: rodam em sequência.
    fileParallelism: false,
    globalSetup: ['./test/setup-db.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
