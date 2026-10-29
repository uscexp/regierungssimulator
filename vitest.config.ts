import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Kern-Tests laufen headless ohne DOM (NFR-004); die Kern-Isolation ist ein Test, kein Review-Kommentar.
    include: [
      'core/src/**/*.test.ts',
      'content/base/src/**/*.test.ts',
      'loader/src/**/*.test.ts',
      'cli/src/**/*.test.ts',
      'scripts/**/*.test.mjs',
    ],
    environment: 'node',
  },
});
