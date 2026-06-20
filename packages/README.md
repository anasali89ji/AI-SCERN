# packages/

Shared code consumed by the apps in `apps/` (or today, by `frontend/` and
`admin/` directly via relative/workspace imports once wired up).

| Package | Purpose |
|---|---|
| [`config/`](./config) | Shared ESLint, Tailwind, and TypeScript base configs |
| [`types/`](./types) | Shared TypeScript types/interfaces (e.g. `ScanResult`, detection modalities) |
| [`ui/`](./ui) | Shared shadcn/ui-based components, once extracted from `frontend/components/ui` and `admin` |
| [`utils/`](./utils) | Small framework-agnostic helpers (e.g. `cn()`) |

## Status: scaffolded, not yet adopted

These packages exist as **empty/minimal placeholders** (Phase 1 of the
file-structure refactor — see `docs/MIGRATION_STATUS.md`). `frontend/` and
`admin/` do **not** import from them yet — their existing local
`lib/`, `components/`, `types/` remain the source of truth for now.

Adoption (moving real code in here and updating imports across `frontend/`
and `admin/`) is a separate, higher-risk phase that touches hundreds of
files and should be done incrementally with builds verified at each step —
not in one pass.

## Why scaffold now if nothing uses it yet?

So that as new shared code is written, it has an obvious home from day one
instead of being duplicated into `frontend/lib` and `admin/lib` separately
(which has already happened in places — e.g. Supabase client helpers).
