# IMG-WORKER-1 — Image-scan worker recovery runbook

**Symptom:** a batch scan (or single image scan) returns

```
Image detection aborted — required worker(s) unavailable:
CV worker (DigitalOcean), GPU worker (HF ZeroGPU)
```

**Status of the two workers (probed 2026-11-19, from this audit):**

| Worker | URL | Finding |
|---|---|---|
| CV worker | `https://aiscern-detection-worker-iakg6.ondigitalocean.app` | **Healthy.** `/health` → 200, v4.12.0, image engines available. A real `/analyze/image` POST completed in **~32s** with the correct response shape. |
| GPU Space | `https://saghi776-ai-scern-signal-worker-l5-l5b.hf.space` | **Broken, running unknown code.** Awake and serving Gradio 4.44.0, but exposes only `analyze` / `run_gpu_analysis` api_names (not the `diffusion_inversion` / `diffusion_snapback` this repo's client calls), and invoking `analyze` returns `event: error`. |

---

## The three root causes (all fixed by this patch)

1. **Frontend GPU protocol was wrong — the GPU leg could NEVER succeed.**
   `callGpuWorker()` in `frontend/lib/inference/hf-analyze.ts` POSTed
   `/analyze/image` then `/api/predict`. Neither route exists on a Gradio 4.x
   Space; the repo's own Space code (`hf-space-gpu-worker/app.py`) serves the
   queue-based `/call/<api_name>` API instead. So `gpuWorkerResult` was always
   null and strict mode aborted every scan. *(Fixed: rewritten to the correct
   `/call/diffusion_inversion` + `/call/diffusion_snapback` protocol with
   `INTERNAL_API_SECRET` and optional `HF_TOKEN` bearer, the same protocol
   `lib/forensic/layers/diffusion-inversion.ts` already used.)*

2. **Batch scans self-DoSed the CV worker.** `/api/detect/batch` ran all items
   through `Promise.all`: a 3-image batch fired 3 concurrent `/analyze/image`
   calls at a single small DigitalOcean instance. Each call needs ~32s of CPU
   single-flight; three at once stretch past the timeout and **all three**
   report "CV worker unavailable" although the worker is healthy one-at-a-time.
   *(Fixed: single-flight lock around the CV HTTP call + bounded image-item
   concurrency in the batch route + timeout raised 45s → 60s.)*

3. **One strict gate turned any blip into total failure.** With
   `REQUIRE_IMAGE_WORKERS`, a single missing worker aborted the whole scan even
   when the other worker and the full Brain+HF+Gemini ensemble responded.
   *(Fixed: policy gate — `IMAGE_WORKERS_REQUIRED=both|any|none`, default
   `any`: complete the scan when at least one worker responds and flag the
   missing one in `degraded_signals`; abort only when neither responds. The
   old `IMAGE_WORKERS_OPTIONAL=true` still works as an alias for `none`.)*

**Net effect:** with the patch applied, the 3-image batch completes using the
CV worker (which is up) even while the GPU Space is still broken — each result
carries `gpu-worker-unavailable` in `degraded_signals` and the model string
shows which pillars produced the verdict.

---

## Recovery steps

### 1. Apply the patch, redeploy the frontend

```bash
git am 0005-image-worker-reliability-IMG-WORKER-1.patch   # or git apply
cd frontend && npm install && npx tsc --noEmit            # verify
# deploy as usual (Vercel: git push; Cloudflare Pages: your existing pipeline)
```

No new env vars are required. Optional new ones:

| Var | Values | Default | Meaning |
|---|---|---|---|
| `IMAGE_WORKERS_REQUIRED` | `both` / `any` / `none` | `any` | Worker policy (frontend + Cloudflare worker `wrangler.toml [vars]`) |
| `IMAGE_WORKERS_OPTIONAL=true` | alias for `none` | — | Backward-compatible with the old escape hatch |
| `HF_TOKEN` | HF access token | — | **Required if the Space is private**; sent as `Authorization: Bearer …` |
| `INTERNAL_API_SECRET` | shared secret | — | If set, must match the Space's secret; the Space functions check it |

### 2. Redeploy the HF Space from this repo (restores L5/L5b)

The deployed Space is running code that is **not in this repository** — it must
be redeployed from `hf-space-gpu-worker/`:

1. Open the Space → **Files**. Replace/update these files with the patched
   versions from `hf-space-gpu-worker/` in this repo:
   `app.py`, `diffusion_inversion.py`, `diffusion_snapback.py`
   (`requirements.txt` unchanged). Easiest: upload the three files in the
   Space's file editor, or reconnect the Space to a git branch containing them.
2. The Space rebuilds automatically. Wait for "Running".
3. Space **Settings → Variables and secrets**: set `INTERNAL_API_SECRET` to the
   same value as the frontend's, and keep the Space **Private** (private Spaces
   require an HF token — set `HF_TOKEN` on the frontend so its calls pass).
4. ZeroGPU quota: L5 costs up to 60s and L5b up to 90s of GPU per call. The
   free tier's daily quota is limited — heavy batch scanning can exhaust it;
   that state now surfaces as a clear "ZeroGPU quota exhausted" reason instead
   of a bare abort.
5. Verify:
   ```bash
   node scripts/check-workers.mjs --gpu https://saghi776-ai-scern-signal-worker-l5-l5b.hf.space --deep
   ```
   `api contract` must PASS and the deep ping round trip must return
   `event=complete`.

### 3. Keep the Space awake (optional)

Free Spaces sleep after ~48h idle; the first call after wake can take 30-60s.
The repo's `ping()` function is CPU-only (no GPU quota). Schedule any cron
(GitHub Actions, cron-job.org) to hit it:
`POST {HF_GPU_WORKER_URL}/call/ping` with body `{"data": []}` every 30-60 min.

### 4. Verify the whole chain

```bash
# From the repo root (Git Bash):
node scripts/check-workers.mjs \
  --cv  https://aiscern-detection-worker-iakg6.ondigitalocean.app \
  --gpu https://saghi776-ai-scern-signal-worker-l5-l5b.hf.space --deep

# After deploying the frontend, the health endpoint now reports the GPU Space too:
curl https://<your-frontend>/api/health
#   signal_worker: "ok",  gpu_worker: "ok" | "api-mismatch" | "offline" | "unconfigured"
```

Then re-run the 3-image batch scan in the dashboard. Expected: all items get
verdicts. `degraded_signals` will list `gpu-worker-unavailable` until the
Space is redeployed (step 2); after that it disappears and L5/L5b scores
participate again.

---

## Capacity notes (why the CV worker timed out)

- One `/analyze/image` call ≈ **32s CPU** on the current single small
  DigitalOcean App Platform instance (measured 2026-11-19).
- The frontend now serializes CV calls (single-flight lock), so a batch of N
  images costs ≈ N × 32s of worker time. The batch route budget
  (`maxDuration = 120`) fits **~3 images**; larger image batches need either a
  higher `maxDuration` (Vercel Pro supports up to 300s) or a bigger worker
  instance.
- If scans queue behind each other regularly, upgrade the DigitalOcean app
  instance (more vCPU) or run 2+ instances behind the platform's load balancer
  — then raise `IMAGE_ITEM_CONCURRENCY` in `frontend/app/api/detect/batch/route.ts`
  and drop the single-flight lock requirement accordingly (see
  `withCvWorkerLock` in `frontend/lib/inference/hf-analyze.ts`).

## Related code paths (unchanged by this patch, for reference)

- `frontend/lib/forensic/layers/diffusion-inversion.ts` /
  `diffusion-snapback.ts` — the Inngest forensic-cascade path; already spoke
  the correct `/call/` protocol and passes hosted R2 URLs (not data URLs), so
  no change needed there.
- `frontend/.cf-stage/` — generated Cloudflare staging copy of the frontend.
  It is NOT touched by this patch; re-run whatever sync process produces it so
  the fixes carry over to that deployment path.
