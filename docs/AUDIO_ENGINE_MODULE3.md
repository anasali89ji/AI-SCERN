# Module 3 — Audio Engine Expansion

Status: landed on `main`.

## Audit (task 1)

`signal-worker/engines/audio_engine.py` was a complete stub — every request
returned `status: "not_implemented"`. Gemini-audio was the only real signal;
`audio_engine.py` contributed nothing. No duplicate-work risk, unlike
Module 2's text audit.

## What was built (tasks 2–3)

Five CPU-only forensic signals via `librosa` (added to `requirements.txt`
along with `soundfile`):

1. **MFCC consistency** — frame-to-frame spectral-envelope dynamism.
2. **Pitch jitter & shimmer** — classic voice-quality micro-variation
   metrics from `librosa.pyin`.
3. **Spectral flatness / centroid stability** — coefficient of variation of
   spectral centroid over time.
4. **Silence/breath-pattern** — variability of pause timing between
   `librosa.effects.split` segments.
5. **Harmonic-to-noise ratio** — via `librosa.effects.hpss` energy split.

Each signal degrades independently (wrapped in try/except, returns
`available: false` + reason rather than raising) so one failing signal never
takes down the whole request. Silence and sub-1-second clips short-circuit
to an honest `insufficient_audio` result (composite 0.5 = uncertain, not a
false confidence claim) rather than producing noisy garbage stats.

`POST /analyze/audio` added to `main.py`, mirroring `/analyze/video`'s
pattern exactly (MIME allowlist, size cap, `run_in_executor`, error →
`HTTPException`).

**Calibration status — explicitly NOT done.** All five signals use
hand-picked thresholds from voice-quality literature, not a labeled
dataset. This is called out directly in `audio_engine.py`'s module
docstring. Do not raise the 35% frontend weight below without running a
Module-4-style calibration pass first.

## Frontend wiring (task 4)

`callPythonAudioWorker()` added to `hf-analyze.ts`, mirroring
`callPythonCVWorkerVideo()`'s timeout/retry/graceful-degrade pattern
exactly (20s timeout, loud non-silent failure logging).

Ensemble restructured: self-hosted worker + HF ensemble now fire
unconditionally in parallel (cheap, self-hosted). Gemini is sequenced
*after* those resolve and only fires when:
- the self-hosted worker is unavailable (worker down/unconfigured — falls
  back to old always-call-Gemini behavior, so the existing fallback path
  is never broken), or
- the worker's score lands in the uncertain band (0.38–0.62), or
- the worker and the heuristic acoustic-signal engine disagree by >0.15

This is the same shape as Module 2's text fallback logic, plus a
`AUDIO_GEMINI_MODE=fallback|parallel|off` kill switch (default `fallback`)
for trivial reversibility, matching `TEXT_GEMINI_MODE`.

Weighted blend (renormalized over whichever sources actually ran):
Gemini 0.35 (demoted from up-to-0.45 pre-Module-3) · self-hosted worker
0.35 · HF ensemble 0.20 · heuristic acoustic signals 0.10.

**Latency tradeoff, stated plainly:** because Gemini is now sequenced
behind the worker's result rather than fired in parallel with everything
else, an uncertain-band request pays worker-latency + Gemini-latency
sequentially instead of in parallel. This is the accepted cost of not
burning a Gemini call on every request — see Module 6 (cost
instrumentation, not yet built) for measuring whether it's worth it.

## Dockerfile fix (found during verification, not in the original task list)

`signal-worker/Dockerfile` had no `libsndfile1` or `ffmpeg` — required for
`soundfile`/`librosa` to decode uploaded audio at all. Added both. Verified
locally: with `ffmpeg` on PATH, a real MP3 (generated via `ffmpeg -i
test.wav test.mp3`) decodes and analyzes correctly end-to-end. Note:
`soundfile`'s bundled `libsndfile` (1.1+) turned out to have native MP3
decode support in this sandbox even without `ffmpeg` reachable — `ffmpeg`
is kept for broader container support (AAC/M4A, which `libsndfile` doesn't
decode natively).

## Startup warmup (found during verification, not in the original task list)

`librosa.pyin`/`hpss` are numba-JIT-compiled on first call — measured
**21s cold vs 0.3s warm** on a 4-second clip in this sandbox. Added a
background warmup call in `main.py`'s `lifespan()` so the JIT cost is paid
once at worker startup, off the request path, instead of by whichever user
happens to send the first audio request after a deploy/cold-start. Verified
via a real `TestClient` lifespan run — warmup log fires, health check
returns 200, clean shutdown.

## Tests (task 5)

`signal-worker/tests/test_audio.py` — 9 tests, all passing against the real
engine (not mocked) in a fresh venv with the actual `librosa`/`soundfile`
dependencies installed:
- Endpoint smoke test (200, correct response shape) + unsupported-MIME
  rejection (415)
- Silence handling → honest `insufficient_audio`, not a crash or a false
  confidence score
- Very short clips (<1s) → same graceful `insufficient_audio` path
- Clips just above the minimum duration → real analysis attempted
- Hard-clipped/distorted audio → does not crash, valid score range
- Pure white noise (no pitch/harmonic structure) → does not crash
- Malformed bytes → clean `status: "error"`, not an unhandled exception
- **Regression guard, with an honest limitation stated in the test
  docstring**: this sandbox has no network egress to a real labeled
  real/synthetic speech dataset (what the module doc's task 5 actually
  asked for). What's implemented instead is a synthetic proxy pair — a
  noisy/irregular waveform standing in for "human-like" vs a perfectly
  regular tone standing in for "robotic" — checked only for *directional*
  correctness (robotic ≥ human − small margin), not real-world accuracy.
  **Before trusting this module's weight, replace this proxy with real
  labeled audio.**

## Verification performed

- `python3 -m pytest tests/test_audio.py -v` — 9/9 passed, real engine, real
  librosa/soundfile, in a fresh venv built for this session.
- `python3 -m pytest tests/test_health.py -v` — 3/3 passed (sanity check
  that nothing else broke).
- Full FastAPI `TestClient` lifespan run (startup → health check → shutdown)
  — confirmed clean, warmup log observed.
- Real MP3 round-trip via `ffmpeg`-generated file — confirmed decode +
  analysis works end-to-end.
- `npx tsc --noEmit` — 0 errors, full frontend project.
- `npm run build` — clean production build.

## Verification NOT performed (honest gaps)

- **Docker image was not built in this sandbox** (no Docker daemon
  available here) — the `libsndfile1`/`ffmpeg` apt-get addition is
  reasoned from first principles and confirmed necessary via local testing
  of the same decode path, but the actual container build was not run.
  Recommend a manual `docker build` + smoke test before deploying.
- **No live signal-worker instance** — `callPythonAudioWorker()`'s
  fetch/timeout/parse logic is written to the same contract the engine
  actually returns (verified via direct Python calls), but an actual
  Next.js → deployed-worker HTTP round-trip was not exercised here.
- **No real labeled audio dataset** — see the regression-guard limitation
  above. The five signals' suspicion directions are internally consistent
  (each score formula was checked by hand and against synthetic examples)
  but not validated against real TTS output or real human speech.

## Next

Module 6 (cost & call-volume instrumentation) is the only module left,
per the plan's ordering. It would let you measure, with real numbers,
whether Module 3's Gemini-demotion logic is actually reducing paid-audio
calls the way Module 2's did for text.
