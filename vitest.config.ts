import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration for Librarian
 *
 * Test tiers controlled by LIBRARIAN_TEST_MODE environment variable:
 * - 'unit' (default): Fast tests with mocked providers
 * - 'integration': Real providers, skip if unavailable
 * - 'system': Real providers required, fail if unavailable
 *
 * See docs/librarian/specs/core/testing-architecture.md for policy.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: (() => {
      const mode = process.env.LIBRARIAN_TEST_MODE ?? 'unit';
      const excluded: string[] = [];

      if (mode === 'unit') {
        excluded.push('**/*.integration.test.ts', '**/*.system.test.ts', '**/*.live.test.ts', 'src/__tests__/agentic/**');
      } else if (mode === 'integration') {
        excluded.push('**/*.system.test.ts', '**/*.live.test.ts', 'src/__tests__/agentic/**');
      }

      return excluded;
    })(),
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: process.env.LIBRARIAN_TEST_MODE === 'system' ? 300000 : 30000,
    hookTimeout: process.env.LIBRARIAN_TEST_MODE === 'system' ? 60000 : 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        'vitest.config.ts',
        'vitest.setup.ts',
      ],
    },
  },
});
