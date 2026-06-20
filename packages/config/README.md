# @aiscern/config

Shared lint/format/type-check base configs, so `frontend/`, `admin/`, and
`cf-pipeline/` don't each maintain a slightly-different ESLint or
`tsconfig.json` from scratch.

| File | Purpose |
|---|---|
| `eslint/base.js` | Base ESLint rules shared by every TS/JS package |
| `eslint/next.js` | Extends `base.js` with Next.js-specific rules (extends `base.js`) |
| `tailwind/preset.js` | Shared Tailwind theme tokens (colors, spacing) — source of truth once `frontend`'s `blue-600`-only design system (see `preview/ui-overhaul-2026`) is extracted here |
| `typescript/base.json` | Base `tsconfig.json` (strict mode, target, module resolution) |
| `typescript/nextjs.json` | Extends `base.json` with Next.js App Router settings |

## Status: not yet wired up

`frontend/.eslintrc*` and `admin/` configs are untouched — this package is a
placeholder target for Phase 2 consolidation. Adopting it means each app's
own config becomes a thin file that does `module.exports = require('@aiscern/config/eslint/next')`.
