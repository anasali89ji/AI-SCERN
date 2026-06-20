# Monorepo Refactor — Migration Status

Tracks progress against the `apps/ + packages/ + infra/ + docs/` target
structure proposed in `PROMPT_1_AISCERN_File_Structure_Refactor`. Read this
before starting the next phase — it captures what the original plan got
wrong about the *actual* repo, found by cloning and inspecting it directly.

## Phase 1 — DONE (this branch: `refactor/monorepo-phase1`)

Purely additive. Nothing existing was moved, renamed, or had its imports
touched. Added:

- `packages/{config,types,ui,utils}` — scaffolded, empty/placeholder, not consumed by any app yet
- `docs/{architecture,api,deployment,contributing}` — scaffolded with README index pages
- `infra/{terraform,docker,scripts,supabase}` — scaffolded; `infra/docker` has draft Dockerfiles + compose for local dev only (not used by Vercel/CF deploys)
- Root `package.json` — added `"workspaces": ["packages/*"]` only (does **not** include `frontend`/`admin`/`cf-pipeline` — see risk notes below)
- `turbo.json`, `.nvmrc` (Node `20`, matching `frontend`'s `engines` field)

Nothing in CI, Vercel, Cloudflare, or Convex config was touched. Existing
`npm install` / build behavior in `frontend/`, `admin/`, `signal-worker/`,
`cf-pipeline/` is unaffected.

## What the original prompt's "current state" got wrong

It modeled the repo as 4 apps (`frontend`, `admin`, `signal-worker`,
`cf-pipeline`) + `supabase/migrations`. The real repo also has:

| Path | What it actually is | Why it matters |
|---|---|---|
| `convex/` | A separate real-time backend (`users.ts`, `notifications.ts`, `health.ts`, `schema.ts`), deployed via root `package.json`'s `convex:deploy` script | Convex CLI expects its config at a known root-relative path — moving this needs care, not a blind `mv` |
| `cf-workers/` | `load-balancer.ts` + `proxy-worker.ts`, deployed via `.github/workflows/deploy-lb.yml` | Separate from `cf-pipeline/` (the scraping pipeline) — easy to conflate the two, they're different systems. This is also *why* `frontend/next.config.cf.mjs` exists: frontend statically exports to Cloudflare Pages and this LB proxies `/api/*` back to the Vercel deployment |
| `aws-training/`, `finetune/`, `training/` | SageMaker training scripts, Kaggle notebooks, ML briefing docs | Not deployable apps at all — don't fit cleanly into `apps/`. Original plan has no place for these; they likely want a top-level `ml/` or `research/`, separate from `apps/` |

## Real risk for the *next* phase (moving `frontend/`, `admin/`, etc.)

Found by inspecting `.vercel/`, `.github/workflows/`, and lockfiles — none
of this was visible from the prompt alone:

1. **Vercel "Root Directory" coupling.** `frontend/.vercel/` confirms
   it's linked as its own Vercel project with Root Directory = `frontend`.
   Moving it to `apps/web` breaks deploys until that's changed in the
   Vercel dashboard (or `vercel.json` monorepo config is added) —
   this is a manual, non-code step.
2. **14 GitHub Actions workflows hardcode paths**: `deploy-cf-pipeline.yml`,
   `deploy-admin.yml`, `deploy-lb.yml`, `deploy-cf-pages.yml`, `ci.yml`,
   `pipeline.yml`, `calibrate.yml`, `hf-warmup.yml`,
   `update-pipeline-tokens.yml`, `update-supabase-secrets.yml`,
   `supabase-keepalive.yml`, `pipeline-status.yml`, `security-audit.yml`,
   `vercel-deploy.yml`. Every one referencing `frontend/`, `admin/`,
   `cf-pipeline/`, or `supabase/` needs a matching path update in the
   *same* commit as any directory move, or deploys silently break.
3. **Four independent lockfiles** (`package-lock.json` at root, `frontend/`,
   `admin/`, `cf-pipeline/`) — these apps are not currently npm-workspace
   members. Adding them to the root `workspaces` array later means
   reconciling/removing the per-app lockfiles, which can shift resolved
   dependency versions. Do this deliberately with a build+test pass after,
   not as a side effect of moving folders.
4. **`supabase/migrations/`** has no `config.toml` checked in, but
   `update-supabase-secrets.yml` and `supabase-keepalive.yml` reference the
   `supabase/` path — confirm what those workflows actually do with that
   path before moving migrations to `infra/supabase/migrations`.
5. **22 open branches** at time of writing (several active `feat/`, `fix/`,
   `preview/` branches). A large structural move on `main` will conflict
   hard against all of them. Land this in small PRs, or coordinate
   merging active branches first.
6. `cf-pipeline/` has **14 separate `wrangler-*.toml` files** (one per
   worker, `b` through `p`-ish naming) plus `deploy-all.sh` — any path
   restructuring inside `apps/pipeline` needs every wrangler config and
   the deploy script updated in lockstep.

## Suggested next phases (not started)

- **Phase 2**: Pick *one* low-traffic piece to move first as a proof of
  the process end-to-end — e.g. `signal-worker/` → `apps/worker/` (Python,
  no Vercel/Convex coupling, one Dockerfile, simplest blast radius) —
  verify its CI workflow(s) and any caller of its URL still work.
- **Phase 3**: Move `cf-pipeline/` → `apps/pipeline/`, updating the 14
  `wrangler-*.toml` files + `deploy-all.sh` + the `deploy-cf-pipeline.yml`,
  `pipeline.yml`, `calibrate.yml`, `hf-warmup.yml` workflows together.
- **Phase 4**: `frontend/` → `apps/web/` and `admin/` → `apps/admin/` —
  highest risk (Vercel dashboard root-directory changes required, most
  workflows touched, most active branches affected). Do this last, and
  coordinate timing with Anas so it doesn't land mid-feature-branch.
- **Phase 5**: Decide a home for `convex/`, `cf-workers/`, and the
  ML-only dirs (`aws-training/`, `finetune/`, `training/`) — these don't
  map cleanly onto the original `apps/` + `packages/` + `infra/` split.
