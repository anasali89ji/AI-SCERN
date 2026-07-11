# Module 5 — Failure Visibility & Dead-Button Fix

Status: landed on `main`.

## What changed

**1. `degraded_signals` on every `DetectionResult` (text, image, audio, video)**

`frontend/lib/inference/hf-analyze.ts` — the `DetectionResult` type now
carries `degraded_signals?: string[]`, a per-request list of which signal
sources were skipped or failed for *that specific* detection. This reuses
the availability flags each ensemble branch (`cvAvailable`/`hfAvailable`/
`llmAvailable` for image, equivalent checks for text/audio) already computed
internally — no new detection logic, just surfacing what was previously only
visible in server logs.

Reason codes are source-specific, e.g.:
- `cv-worker-offline` / `cv-worker-unconfigured`
- `hf-ensemble-cold-or-failed` / `hf-ensemble-unconfigured`
- `gemini-call-failed` / `gemini-unconfigured`
- `nvidia-nim-unconfigured` / `nvidia-nim-call-failed`
- `perplexity-worker-unavailable`

An empty array means the full ensemble ran. This lets ARIA (or the UI)
honestly say "this result used fewer signals than usual" instead of
presenting a partial ensemble as a full one.

**2. Dead-button fix — `detect/image/route.ts`**

Audited the "Deep Forensic Analysis" button flow. The frontend
(`app/(dashboard)/detect/image/page.tsx`) already guards the button on
`forensicScanId` being truthy, and `forensicScanId` is only set from a
successful cascade insert — so the literal dead-button click-through was
already prevented by an earlier session's `insertErr` check. What was
missing was *why*: the API response gave no reason code when the cascade
wasn't created.

Now every `/api/detect/image` response includes:
- `forensic_available: boolean`
- `forensic_unavailable_reason: 'R2_NOT_CONFIGURED' | 'UPLOAD_SKIPPED' | 'CASCADE_FIRE_FAILED' | null`
- `result.degraded_signals: string[]` — merges the ensemble's own
  degraded_signals with a `forensic-cascade-*` entry when applicable.

**3. `/api/health` extended — `frontend/app/api/health/route.ts`**

Previously only reported `signal_worker` status (C.2.1). Now also reports:
- `gemini: 'configured' | 'unconfigured'`
- `nvidia_nim: 'configured' | 'unconfigured'`
- `huggingface: 'configured' | 'unconfigured'`

These are **key-presence checks, not live round-trip calls** — deliberately,
to avoid burning paid-vendor quota/rate-limit on every health poll. Live
per-request failures are what `degraded_signals` on detection responses is
for; `/api/health` is for "is this even configured" ops visibility.

## Verification

- `npx tsc --noEmit` — 0 errors, full project, before and after changes.
- `npm run build` — clean production build, all routes compiled.
- Not verified: a live round-trip against a real degraded signal-worker/
  Gemini/NIM outage in this sandbox — no network egress to those services
  here. The logic paths (`cvAvailable === false`, `geminiScore === null`,
  etc.) are exercised by the existing branching that was already tested in
  prior sessions; this module only adds visibility on top of branches that
  were already live. Recommend a manual smoke test in staging: temporarily
  unset `PYTHON_WORKER_URL` and confirm `degraded_signals` includes
  `cv-worker-unconfigured` on the next image scan.

## Next

Module 3 (audio engine expansion) is next per the plan's own ordering —
this failure-visibility infrastructure needed to land first since Module 3
adds a new failure surface (audio forensic signals) you don't want to fly
blind on.
