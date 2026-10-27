import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Der Kern ist eine pure Funktion — Param-Mutation im Core ist ein Architekturfehler (ADR-002).
      'no-param-reassign': 'error',
    },
  },
);
