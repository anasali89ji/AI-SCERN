# Connecting Aiscern Frontend to the Python Signal Worker

## Why the Gemini image says "HUMAN"

The Aiscern report shows:
```
configure PYTHON_WORKER_URL for best accuracy
Brain verdict: HUMAN (30%)
```

This means the frontend's **Image Brain** is running in fallback mode — it is NOT
calling the Python signal worker. The worker returns 0.87 AI-GENERATED for this image
(Gemini PNG, sparkle artifacts confirmed), but the frontend never receives that result.

## Fix: Set PYTHON_WORKER_URL in Vercel

### 1. Find your DigitalOcean worker URL

Go to: https://cloud.digitalocean.com/apps  
Select the `aiscern-detection-worker` app → **Settings → App-Level Domains**  
Your URL looks like: `https://aiscern-detection-worker-xxxxx.ondigitalocean.app`

Test it:
```bash
curl https://aiscern-detection-worker-xxxxx.ondigitalocean.app/health
```
Should return `{"status": "ok", ...}`

### 2. Add the env var to Vercel

Go to: https://vercel.com/dashboard → Aiscern project → **Settings → Environment Variables**

| Name | Value | Environment |
|------|-------|-------------|
| `PYTHON_WORKER_URL` | `https://aiscern-detection-worker-xxxxx.ondigitalocean.app` | Production, Preview |

**Do NOT include a trailing slash.**

### 3. Redeploy Vercel

After adding the env var, trigger a redeploy:
```bash
vercel --prod
```
Or push any commit to trigger auto-deploy.

### 4. Verify the connection

After deploy, test with the Gemini image. The report should show:
```
Image Detection Brain — 87%  ⚠ flagged
Brain verdict: AI-GENERATED (87%)
generator: gemini_imagen
structural_match: 42%
```

---

## Latency improvements (v4.3.1)

| Before | After |
|--------|-------|
| 17,000ms (frontend reported) | ~2,000ms (warm, unique image) |
| 10,000ms (cold per-image) | ~6,000ms (first startup — one-time) |
| No cache | 0ms (same image, LRU cache 50 entries) |

### What was slow (and fixed):

| Bottleneck | Root Cause | Fix | Before → After |
|---|---|---|---|
| L1 Clone Detection | O(n²) loop over 16k patches on 1.1Mpx image | O(n log n) sorted descriptors, 320px cap | 8.7s → 40ms |
| L10 Biological Markers | Hough circles + sliding windows on full res | 384px resize cap | 9.3s → 180ms |
| All analyzers | Processing full 928×1152px (1.1Mpx) | 512px cap per layer | 2-10x speedup |
| URL path | No resize at all (bytes path had 1024px cap) | 768px cap added | Was ~2x slower |
| Same image resubmitted | Full re-analysis every time | SHA-256 LRU cache | 2s → 0ms |

---

## Production sizing (your current plan)

`professional-s`: **4GB RAM | 2 vCPUs** — this is correct for the current pipeline.

Worker parallelism: 12 ThreadPoolExecutor workers running:
L1, L2, L3, L4, L6, L7, L8, L9, L10 + SynthID + v3-forensics (all concurrent).

Wall-clock time is bounded by the slowest parallel group ≈ **1.9s** (v3 forensics).

---

## Testing the worker directly

```bash
# Health check
curl https://YOUR_WORKER_URL/health

# Image analysis (upload file)
curl -X POST https://YOUR_WORKER_URL/analyze/image \
  -F "file=@/path/to/image.png"

# Image analysis via URL
curl -X POST https://YOUR_WORKER_URL/analyze-signals \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/image.png"}'
```
