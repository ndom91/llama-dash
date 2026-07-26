import { defineConfig } from 'vitest/config'

/**
 * Separate from vite.config.ts so server tests don't pull TanStack Start / React plugins.
 * Unit tests mock boundaries; integration tests use :memory: SQLite + a mocked undici fetch.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          setupFiles: ['src/test/integration-setup.ts'],
          fileParallelism: false,
          env: {
            DATABASE_PATH: ':memory:',
            INFERENCE_BASE_URL: 'http://llama-swap.test',
            CREDENTIAL_ENCRYPTION_KEY: 'test-credential-encryption-key-32chars',
            LOCAL_BACKEND_MAX_CONCURRENT: '8',
            LOCAL_BACKEND_MODEL_GROUPING: 'false',
            MODEL_QUEUE_BATCH_WINDOW_MS: '0',
          },
        },
      },
    ],
  },
})
