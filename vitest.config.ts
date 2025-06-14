import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['dist', 'coverage', 'node_modules', 'src/cli.ts'],
      all: true,
      thresholds: {
        statements: 98,
        branches: 85,
        functions: 100,
        lines: 98,
      },
    },
  },
}); 