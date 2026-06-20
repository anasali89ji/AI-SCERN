/**
 * @aiscern/config — base ESLint rules shared across all TS/JS packages.
 * Apps extend this rather than redefining rules from scratch.
 *
 * NOT YET CONSUMED by frontend/ or admin/ — see packages/config/README.md.
 */
module.exports = {
  root: false,
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
