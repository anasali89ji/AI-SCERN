# Module 6 — Cost & Call-Volume Instrumentation

Status: landed on `main`. Final module of the remediation plan.

## What was built

**1. `vendor_call_log` table + `increment_vendor_call()` RPC (Supabase)**

Applied live to `detectai-v2` (project ref `lpgzmruxaeikxxayjmze`) via the
Supabase MCP tool, then copied into
`supabase/migrations/v22_vendor_call_instrumentation.sql` for tracking —
same "apply live, then commit the file" approach as Module 4, called out
explicitly per that module's finding that repo migration files and the
live DB had drifted before.

Schema: one row per `(day, vendor, modality)`, atomically incremented via
`increment_vendor_call(p_vendor, p_modality, p_by)`. RLS: `service_role`
only (ops/admin table, same shape as `worker_health`, not user-facing).

**Verified live**, not just applied: ran `increment_vendor_call('gemini',
'text', 1)` twice + once for `nvidia_nim`/`video`, confirmed the row
correctly summed to `call_count: 2` via upsert-on-conflict, then cleaned up
the test rows.

**2. `trackVendorCall()` — `frontend/lib/inference/vendor-call-tracker.ts`**

Fire-and-forget wrapper around the RPC. Never awaited by callers, every
failure path is `console.error`-logged and swallowed — matches the "never
break the fallback path" global rule from the plan header.

Instrumented at 8 call sites in `hf-analyze.ts`, right where each paid
vendor's network call actually fires (not just "considered" — a fetch that
later fails/times out still cost a request against the vendor's quota in
most cases):

| Modality | Vendor | Count per call |
|---|---|---|
| text  | Gemini | 1 (only when `geminiShouldRun`) |
| text  | HuggingFace | 6 (unconditional ensemble) |
| image | Gemini | 1 (when Gemini configured) |
| image | HuggingFace | 6 (unconditional ensemble) |
| audio | Gemini | 1 (only when `geminiShouldRun`, Module 3's fallback logic) |
| audio | HuggingFace | 3 (unconditional ensemble) |
| video | NVIDIA NIM | 1 (per NIM call, not per frame) |
| video | HuggingFace | up to 8 (one per sampled fallback frame) |

**3. `/api/pipeline-cost-summary` — `admin/app/api/pipeline-cost-summary/route.ts`**

Reads `vendor_call_log` for a `?days=` window (default 7, capped 90),
rolls up into: per-vendor-per-modality totals, a daily time series, and a
per-modality **paid-call rate** (`paid_calls / detections`) using
`scans.media_type` counts as the denominator — verified against the live
schema (initially assumed a `type` column; the real column is
`media_type`, confirmed via a live `information_schema` query before
writing the route, not guessed).

Task 3's weekly checkpoint is built in: any modality where `paid_call_rate
> 0.40` gets `flagged: true` in the response — a signal to revisit
calibration (Module 4's pattern), not a hard alert.

**4. `PipelineCostSummaryTab` — admin dashboard**

New "Pipeline Cost" tab under the SYSTEM group in the sidebar, next to
Health Monitor. Shows per-vendor call totals with a modality breakdown,
and a per-modality paid-call-rate panel that visually flags anything over
the 40% threshold. Follows the existing `HealthTab.tsx` SWR + `api-client`
pattern exactly (same polling interval, same card/shimmer components).

This directly answers Module 6's stated acceptance criterion: *"what % of
text/image/audio/video detections this week used zero paid API calls"* —
`1 - paid_call_rate` per modality, visible in the tab.

## Verification performed

- **Live Supabase**: `list_projects` confirmed project ref match, migration
  applied via `apply_migration`, RPC tested with real increments (verified
  atomic upsert behavior), test rows cleaned up. `scans.media_type` column
  name and its actual values (`text`/`image`/`audio`/`video`) confirmed
  via live schema query before the route was written.
- `npx tsc --noEmit` — 0 errors, both `frontend/` and `admin/` (admin's
  `node_modules` had to be installed fresh in this sandbox first).
- `npm run build` — clean production build, both apps. Confirmed
  `/api/pipeline-cost-summary` compiled as a route in the admin build
  output.
- Cross-checked `trackVendorCall()`'s Supabase call shape (`.rpc(name,
  params)`, `p_`-prefixed snake_case params, `{ data, error }`
  destructuring) against an existing fire-and-forget RPC call already in
  the same file (`checkRateLimitAsync` → `check_and_increment_rate_limit`)
  for consistency, rather than inventing a new convention.

## Verification NOT performed (honest gaps)

- **No live end-to-end request was sent through the actual detection
  pipeline** — the 8 `trackVendorCall()` call sites are unit-verified by
  reading (typecheck-clean, matches established patterns) and the RPC
  itself is proven live, but a real `analyzeText()`/`analyzeImage()`/etc.
  call in a running Next.js process, hitting the real vendor_call_log
  table end-to-end, was not exercised in this sandbox (no live app server,
  no real HF/Gemini/NIM credentials reachable here).
- **The `/api/pipeline-cost-summary` route was not hit over real HTTP** —
  `requireAdmin()` needs a real admin session/auth flow this sandbox can't
  construct. The route's logic was verified by reading against the live
  DB schema and by a clean build, not by an actual authenticated request.
- **No real production call volume yet** — `vendor_call_log` is empty in
  production as of this module landing (the test rows were deleted). The
  dashboard tab and fallback-rate flags will show "No detection volume in
  this window yet" until real traffic accumulates.

## All 6 modules — final status

1. ✅ Video-through-image-engine reuse
2. ✅ Text engine / Gemini fallback
3. ✅ Audio engine expansion
4. ✅ Image re-weighting (config-ready; blocked on `scan_feedback` volume,
   by design — no evidence, no weight change)
5. ✅ Failure visibility & dead-button fix
6. ✅ Cost & call-volume instrumentation

Module 4's calibration script (`calibrate-image-weights.js`) and Module
6's new dashboard together mean the next natural step — once real
production traffic accumulates — is a real calibration pass across
Modules 3 and 4 using actual measured numbers instead of the heuristic
starting weights documented throughout this remediation.
