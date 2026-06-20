/**
 * @aiscern/config — Next.js ESLint preset. Extends ./base.js.
 *
 * NOT YET CONSUMED by frontend/ or admin/ — see packages/config/README.md.
 */
module.exports = {
  root: false,
  extends: ['./base.js', 'next/core-web-vitals'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
