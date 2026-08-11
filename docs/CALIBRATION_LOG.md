# Image Ensemble Calibration Log

# Image Ensemble Calibration Log

**Status: infrastructure now live, zero labeled data yet — calibration still cannot run.**

## Update (this session)

Discovered via direct Supabase query that `model_predictions` and
`scan_feedback` **did not exist in production** — `supabase/migrations/
accuracy_monitoring.sql` had been written (per repo history) but never
actually applied. This meant:

- `logModelPredictions()` (called from every image/text/audio/video detect
  route) had been silently failing on every single scan since it was
  added — the `.insert()` call errors out, is caught, and only logs a
  `console.warn`. No per-model breakdown was ever actually being recorded.
- `/api/detect/feedback` (the ground-truth submission endpoint) had the
  same problem — writes to a table that didn't exist.
- `model_accuracy_7d`, `model_accuracy_30d`, `ensemble_accuracy` views and
  the RAG `detection_embeddings` table/RPC were all unusable.

**Fixed:** applied `accuracy_monitoring.sql` directly to the production
Supabase project (`lpgzmruxaeikxxayjmze` / detectai-v2) via the connected
Supabase tool, and smoke-tested the write path (inserted + deleted a test
row against a real scan id). Confirmed as of this run:

| Table | Rows |
|---|---|
| `model_predictions` | 0 (347 historical image scans exist, but none logged — this only starts accumulating from now on) |
| `scan_feedback` | 0 |

**What this means for MODULE 4:** the pipe is finally connected, but there
is no ground-truth-labeled data yet, and 347 pre-existing scans can never
retroactively gain a `model_predictions` breakdown (that data was never
captured). `.github/scripts/calibrate-image-weights.js` will keep refusing
to output a result until `scan_feedback` accumulates real ground truth —
which requires actual usage of the feedback flow (user corrections in the
product UI, or admin/benchmark labeling runs). This is a genuine "needs
time to accumulate" blocker, not something further code changes can fix.

## Current production weight split (v8.1, unchanged)

Documented in `frontend/lib/inference/hf-analyze.ts` — search for
`IMAGE ENSEMBLE v8.2` for the full rationale and all fallback-branch
splits. Full-ensemble case:

| Component | Weight |
|---|---|
| Image Brain | 31% |
| Python CV Worker | 22% |
| HF ViT ensemble | 18% |
| Raw pixel signals | 9% |
| LLM Vision (Gemini) | 20% |

## How to run a real calibration (once data exists)

```
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
node .github/scripts/calibrate-image-weights.js
```

Defaults to refusing output below 100 labeled samples (`MIN_SAMPLES`).
Check volume first:

```sql
select count(*) from scan_feedback sf join scans s on s.id = sf.scan_id where s.media_type = 'image';
```

Per MODULE 4's own rule ("do not guess, measure"), the weight constants in
`hf-analyze.ts` should only be changed by hand after reading that output,
not automatically.

