# infra/

Infrastructure-as-code and deployment scaffolding.

| Dir | Status |
|---|---|
| [`terraform/`](./terraform) | Empty scaffold — no Terraform in use today; deploys are Vercel/Cloudflare/Supabase dashboards + GitHub Actions |
| [`docker/`](./docker) | Draft Dockerfiles + `docker-compose.yml` for **local dev only** — not used by any current deploy pipeline |
| [`scripts/`](./scripts) | `setup.sh` — local bootstrap across the 4 independent npm projects |
| [`supabase/`](./supabase) | Notes only — migrations themselves remain at root `supabase/migrations/` for now, see its README |

Nothing here replaces the real deploy mechanism, which is still:
Vercel (frontend, admin) + Cloudflare Workers/Pages (cf-pipeline, cf-workers,
frontend static export) + Supabase + Convex, orchestrated by
`.github/workflows/*.yml`.
