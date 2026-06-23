# Aiscern Signal Worker — Deployment Notes v4.2.0

## What shipped in v4.2.0 (P0–P6)

| Phase | Commits | Key changes |
|-------|---------|-------------|
| P0 | 3 | SSRF protection, unified version, .dockerignore |
| P1 | 1 | Thread-safe model cache (RLock), OpenCV DNN face detector, multi-stage Dockerfile, DCT Layer 2 |
| P2 | 1 | Shared httpx connection pool, BUG-7 cleanup, datetime.timezone.utc |
| P3 | 2 | TTL model eviction, /metrics (Prometheus), /analyze/batch, MIME allowlist, OOM middleware |
| P4 | 1 | ZED (L6), DIRE (L7), NLM (L8) CPU-only detectors — 7 total layers |
| P5/P6 | 1 | Structured JSON logging, /admin/cache, rate limiting, load test script |

---

## DigitalOcean App Platform — Deploy checklist

### 1. First deploy (or fresh environment)

```bash
doctl apps create --spec signal-worker/app.yaml
```

### 2. Subsequent deploys (push to main triggers auto-deploy)

```bash
git push origin main   # deploy_on_push: true in app.yaml
```

### 3. Required secrets (set in DO App Platform dashboard → App Settings → Environment Variables)

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://...` | Supabase/DO Managed Postgres |
| `REDIS_URL` | `rediss://...` | Optional — only if using Redis cache |
| `OPENAI_API_KEY` | `sk-...` | Optional — only if OpenAI layers enabled |
| `ADMIN_API_KEY` | `<random 32-char hex>` | Guards `/admin/cache` endpoints |

Generate a strong admin key:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Env vars already in app.yaml (no action needed unless you want to override)

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `8080` | DO App Platform standard |
| `LOG_LEVEL` | `INFO` | Change to `DEBUG` only for troubleshooting |
| `GPU_ENABLED` | `false` | Set `true` on GPU droplets only |
| `RATE_LIMIT_REQUESTS` | `60` | Requests per window per IP |
| `RATE_LIMIT_WINDOW_S` | `60` | Window size in seconds |
| `MODEL_IDLE_TTL_SECONDS` | `300` | Evict models idle for 5m |
| `MODEL_EVICTION_INTERVAL` | `60` | Eviction check frequency |

---

## Instance sizing decision

> **Deferred by user — do not change app.yaml instance_size_slug without explicit approval.**

Current spec: `basic-xs` (1 vCPU, 1 GB RAM, $12/mo).

Current DO pricing (as of June 2026):

| Slug | vCPU | RAM | Price |
|------|------|-----|-------|
| `basic-xxs` | 1 | 512 MB | $5/mo |
| `basic-xs` | 1 | 1 GB | **$12/mo** ← current |
| `basic-s` | 1 | 2 GB | $25/mo |
| `basic-m` | 2 | 4 GB | $50/mo |

**Upgrade trigger**: if OOM middleware (`/metrics` → `oom_evictions_total`) fires more than 3x/hour under normal load, upgrade to `basic-s`. This is a 1-line change in `app.yaml`:

```yaml
instance_size_slug: basic-s
```

With L6/L7/L8 now CPU-only and the 10-worker thread pool, peak RSS under the 20-URL batch endpoint on `basic-xs` is approximately 700–800 MB (OOM threshold is 850 MB). **Monitor for 48h post-deploy before deciding.**

---

## Admin API

All admin endpoints are protected by `X-Admin-Key: <ADMIN_API_KEY>` when the env var is set.

```bash
# Inspect model cache
curl -H "X-Admin-Key: $ADMIN_API_KEY" \
     https://<your-app>.ondigitalocean.app/admin/cache

# Force-clear all cached models (useful after hot-deploy)
curl -X DELETE -H "X-Admin-Key: $ADMIN_API_KEY" \
     https://<your-app>.ondigitalocean.app/admin/cache
```

## Load testing

```bash
# Quick smoke test (5 workers, 20 requests)
python3 signal-worker/scripts/load_test.py \
    --url https://<your-app>.ondigitalocean.app \
    --workers 5 --requests 20 --admin --metrics

# Stress test to observe 429 rate-limiting behaviour
python3 signal-worker/scripts/load_test.py \
    --url https://<your-app>.ondigitalocean.app \
    --workers 20 --requests 200
```

## Prometheus metrics

`GET /metrics` returns a Prometheus-compatible text scrape including:

```
aiscern_requests_total
aiscern_errors_total
aiscern_oom_evictions_total
aiscern_avg_latency_ms
aiscern_image_detections_total
aiscern_text_detections_total
aiscern_video_detections_total
aiscern_audio_detections_total
```

Grafana Cloud free tier can scrape this directly. Add a push-gateway or use
DO's built-in metrics if you prefer managed monitoring.

---

## Post-deploy verification

```bash
BASE=https://<your-app>.ondigitalocean.app

# Health
curl $BASE/health

# Metrics (Prometheus text)
curl $BASE/metrics

# Admin cache
curl -H "X-Admin-Key: $ADMIN_API_KEY" $BASE/admin/cache

# Analyze a test image (local PNG)
curl -X POST $BASE/analyze/image \
     -H "Content-Type: image/png" \
     --data-binary @test.png | jq .layers[].layer

# Batch endpoint
curl -X POST $BASE/analyze/batch \
     -H "Content-Type: application/json" \
     -d '{"urls": ["https://picsum.photos/200"]}' | jq .results[].layers | wc -l
```

Expected: 7 layers per image (L1, L2, L3, L4, L6, L7, L8).

---

## P7 (next session)

Monorepo restructure deferred. Planned:
- `signal-worker/` → proper Python package layout with `pyproject.toml`
- Move `analyzers/`, `engines/`, `utils/`, `forensics/` into `aiscern_worker/`
- Update all internal imports
- Final tag `v4.2.0`

**Do not restructure until all layers are stable in production for ≥48h.**
