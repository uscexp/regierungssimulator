import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node-Skripte (Check-Skripte, Tests in scripts/) brauchen Node-Globals; TS-Dateien typet tsc.
    files: ['**/*.mjs', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      // Der Kern ist eine pure Funktion — Param-Mutation im Core ist ein Architekturfehler (ADR-002).
      'no-param-reassign': 'error',
    },
  },
);
