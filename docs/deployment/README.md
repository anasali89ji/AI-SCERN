# docs/deployment/

Target layout for deployment runbooks:

- `vercel.md` — `frontend` + `admin` Vercel projects (Root Directory settings, env vars)
- `cloudflare.md` — `cf-pipeline` Workers (14 `wrangler-*.toml` configs), `cf-workers` load balancer/proxy, Cloudflare Pages static export of `frontend`
- `supabase.md` — migrations workflow, RLS, connection pooling
- `convex.md` — `convex/` deploy (`npm run convex:deploy`)

Not written yet. See `../MIGRATION_STATUS.md` for what's been learned about
how these pieces are actually wired together (Vercel root-directory
coupling, the 14 GitHub Actions workflows, etc.) — that's the starting
point for writing these for real.
