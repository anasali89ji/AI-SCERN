# infra/scripts/

- `setup.sh` — bootstraps local dev across the 4 independent
  npm/pip projects (`frontend`, `admin`, `cf-pipeline`, `signal-worker`).
  Not a replacement for real deploy scripts (`cf-pipeline/deploy-all.sh`,
  `cf-pipeline/deploy.sh` already exist and are untouched).

`deploy.sh` / `migrate.sh` from the original plan are **not** added here —
real deploys already run through `.github/workflows/*.yml` (Vercel CLI,
`wrangler`, Supabase) and shouldn't get a second, parallel script that can
drift out of sync. If that changes, add them here deliberately.
