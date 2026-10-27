import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['core/src/**/*.test.ts', 'loader/src/**/*.test.ts', 'cli/src/**/*.test.ts'],
    environment: 'node',
  },
});
