# Aiscern Image Ensemble Worker

Fixes the "Failed to fetch" image-detection timeout on Vercel Hobby. See the
commit message on `main` (`Fix image detection timeout: async Cloudflare
Worker hand-off...`) for the full architecture writeup — this file is just
the deploy runbook.

**Status: written and typechecked, NOT deployed.** Until you deploy it and
set the Vercel env vars below, `/api/detect/image` silently falls back to the
original synchronous path (no behavior change, no breakage — just still
subject to the original timeout).

## 1. Deploy the worker

```bash
cd cloudflare-worker
npm install
npx wrangler login              # opens a browser, links your Cloudflare account
npx wrangler deploy
```

This prints your worker's URL, something like:
`https://aiscern-image-ensemble.<your-subdomain>.workers.dev`

## 2. Set worker secrets

```bash
npx wrangler secret put HUGGINGFACE_API_TOKEN     # same value as Vercel's HUGGINGFACE_API_TOKEN
npx wrangler secret put GEMINI_API_KEY            # same value as Vercel's GEMINI_API_KEY
npx wrangler secret put GEMINI_API_KEY_2          # optional — same as Vercel's, if you have one
npx wrangler secret put PYTHON_WORKER_URL         # same value as Vercel's PYTHON_WORKER_URL
npx wrangler secret put WORKER_SHARED_SECRET      # generate a new random string, e.g. `openssl rand -hex 32`
npx wrangler secret put CALLBACK_BASE_URL         # your production URL, e.g. https://aiscern.com
```

**`WORKER_SHARED_SECRET`** — generate this once, then use the SAME value for
both this and the Vercel env var below (`IMAGE_WORKER_SECRET`). It's how the
worker and Vercel prove requests to each other are legitimate, not from a
random third party who found the URLs.

## 3. Set Vercel env vars (Project Settings → Environment Variables)

| Name | Value |
|---|---|
| `IMAGE_WORKER_URL` | The worker URL from step 1 (no trailing slash) |
| `IMAGE_WORKER_SECRET` | The SAME value you used for `WORKER_SHARED_SECRET` above |

Redeploy the Vercel project after adding these (env var changes need a fresh
deploy to take effect).

## 4. Verify it's live

Run an image detection in production, then check:
- Vercel function logs for `/api/detect/image` — should show it returning
  fast (~1-2s) with `status: 'processing'`, NOT calling `analyzeImage()`.
- Cloudflare dashboard → Workers → aiscern-image-ensemble → Logs — should
  show the `/analyze` requests coming in and completing.
- The client should show the loading state for a few seconds, then resolve
  to a result — same as before, just via polling instead of one long request.

If something's misconfigured, the route logs `[detect/image] Worker hand-off
failed, falling back to sync path: <reason>` and silently uses the old
synchronous path — nothing breaks, it just doesn't get faster. Check that log
line first if detection still seems slow/timing out after deploying.

## Rollback

Unset `IMAGE_WORKER_URL` in Vercel (or just leave it unset) — the route falls
straight back to the synchronous path with zero code changes needed.
