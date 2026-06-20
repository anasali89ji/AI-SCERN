# infra/docker/

Draft local-dev Docker setup. **Not used by any production deploy** —
`frontend`/`admin` deploy via Vercel + Cloudflare Pages, `cf-pipeline` via
Cloudflare Workers, `signal-worker` via DigitalOcean App Platform (it
already had its own `Dockerfile`, reused as-is here).

- `Dockerfile.web` — drafted for `frontend/`, no `output: 'standalone'` in
  `next.config.js` so this is a plain full-`node_modules` build, not the
  leaner standalone pattern
- `Dockerfile.admin` — same pattern for `admin/`
- `docker-compose.yml` — wires `web` + `admin` + `worker` together for
  local dev; each service still needs its own `.env*` file (gitignored,
  not created by this compose file)

Untested against the real apps in this pass — verify locally before relying
on it (`docker compose -f infra/docker/docker-compose.yml up`).
