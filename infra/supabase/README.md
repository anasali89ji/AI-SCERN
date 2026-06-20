# infra/supabase/

The real migrations are **still at root `supabase/migrations/`** — they
were deliberately *not* moved here in Phase 1.

Why: `.github/workflows/update-supabase-secrets.yml` and
`supabase-keepalive.yml` reference the `supabase/` path, and there's no
checked-in `config.toml` to confirm the Supabase CLI's working-directory
assumptions. Moving migrations needs those workflows (and local dev
muscle memory — `cd supabase && ...`) updated in the same change, not as
a side effect of monorepo scaffolding. See `../../docs/MIGRATION_STATUS.md`.
