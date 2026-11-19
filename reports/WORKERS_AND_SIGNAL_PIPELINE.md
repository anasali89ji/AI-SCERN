# WORKERS AND SIGNAL PIPELINE (Module 6)

## Signal worker (Python) — test results

**Final: 444 passed, 1 skipped, 0 failed** (test_accuracy.py: 24 passed; rest of suite: 420 passed). 6 tests in `test_gpu_worker.py` are **environment-blocked** (require a live GPU worker service at `HF_SPACE_URL` — unavailable in this sandbox; not counted as passing).

### Fixed this module

| ID | Test failure | Root cause | Fix |
|---|---|---|---|
| PY-LSA-1 | `test_lsa_reports_real_measurements`, `test_lsa_block_is_provisional_and_unscored` (`KeyError: 'lsa'`) | Module 2.6 skipped the SVD entirely because LSA carries zero score weight — which also removed the measurements from the response, breaking the documented honest-evidence contract | Restored the measurement compute (always measure, never score): `_semantic_signal` no longer early-returns; `_LSA_SCORING_ENABLED` now documents only the closed SCORE path. Zero score impact (verified `_score()` ignores LSA). 32/32 syntactic-semantic tests pass |
| PY-STAT-1 | `test_layer_reports_schema` (`assert 'not_applicable' in ('success','failure')`) | Engine legitimately reports `not_applicable` (e.g. MakerNote layers on files without maker notes); test predated the status | Test accepts the honest status trio; `failure` still fails |
| PY-STAT-2 | `test_all_7_layers_fire_via_bytes_path` (required every layer `success`) | 30-layer engine reports `not_applicable` for inapplicable auxiliary layers on a 64×64 noise PNG | Mandatory P4 layers (1–4, 6–9) must be `success`; auxiliary layers may be `success`/`not_applicable`, never `failure` |
| GFE-SPARKLE-1 | `test_ai_images_detected[7-dark scene with sparkles]` (fused 0.40 < 0.50) | Two-layer calibration defect: (a) the sparkle detector scaled evidence by DENSITY only — calibrated on full Gemini outputs (density 0.001–0.008), so a 60-sparkle fixture (density 0.0003) scored 0.035 although the COUNT of isolated spikes is the decisive evidence (real-photo fixtures produce **zero** candidates); (b) the L7 DIRE reality check (dark fields reconstruct trivially → "real") vetoed every non-EXIF override floor, so even a firing L10 attribution (0.9149) could not surface | (a) `_gemini_sparkle_evidence()` returns full evidence (count/isolation/density/decisive); presence floor 0.78 at count ≥ 15 + isolation ≥ 0.6 (Poisson-tail rationale documented); (b) fusion treats a DECISIVE sparkle fingerprint (L10 flag + suspicion ≥ 0.62 corroboration) as fingerprint-class evidence — like the EXIF exception it survives the DIRE veto, flooring at 0.82 with `override_reason=sparkle_fingerprint_gemini`. Battery verified: sparkles 0.82 PASS, real photos 0.5698/0.5749 (< 0.70) PASS, other AI fixtures 0.588–0.591 (> 0.50) PASS |

### Verified, no defect

- Audio forensic pipeline L1/L2/L3/L4: missing features are neutral 0.5 (not misleading defaults); empty transcription handled (frontend guard in Module 4).
- GPU/HF deployment variants: Dockerfiles ×4, requirements ×3 — topology documented in Module 1; live validation blocked (no GPU service).
- `pywt` dependency was missing in the sandbox (not in the default env) — installed; tests that need it now pass (this is a sandbox artifact, requirements.txt already lists it — verified).

## Cloudflare pipeline

- `cf-pipeline/`: 18 wrangler configs, TypeScript — `tsc --noEmit` **PASS** (required installing `@cloudflare/workers-types`, `--no-save`, lockfile untouched).
- No test suite exists for cf-pipeline (recorded as gap G-4 in BASELINE.md).
- `wrangler deploy --dry-run` not run: wrangler not installed in sandbox (heavy dependency; would also need account credentials). **Blocked, documented.**
- Legacy/duplicate worker candidates (`cf-workers/`, `cloudflare-worker/`, root `cloudflare-worker.ts`) — flagged in Module 1; not edited (decommissioning a possibly-live endpoint is a product decision requiring deployment evidence).

## Inngest functions (frontend)

8 functions verified wired via `/api/inngest` (onScanCompleted, onScanFeedback, processFeedbackJob, scheduledPipelineCheck, executeWorkflow, auditChainAnchor, deliverVerificationWebhook). Live retry/idempotency behavior requires Inngest credentials — **blocked-live**, code-path verified.
