import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
    },
  },
  {
    // tsconfig.json excludes tests and e2e (they are type-checked by vitest's
    // own transform instead), so they cannot use parserOptions.project —
    // parse them without type-aware linting (no type-aware rules are used).
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: false },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Register the react-hooks plugin: two source files carry
    // eslint-disable comments for react-hooks/exhaustive-deps, and an
    // unregistered rule referenced in a disable comment is itself an error.
    files: ['**/*.tsx', '**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    rules: {
      'no-unused-vars': 'warn',
    },
  },
  {
    // .cf-stage is a generated marketing-only deployment export with its own
    // tsconfig — linting/vetting it with the canonical project's tsconfig
    // produced 280 bogus parser errors and hid real findings.
    ignores: ['.next/**', 'node_modules/**', 'out/**', '.cf-stage/**'],
  },
]
