# AISCERN — Remediation Changelog

This file tracks every behavioral change made during the AISCERN_MASTER_FIX_PROMPT
remediation pass, grouped by module (H → G → A → C → F → B → D → E per the
prompt's strict work order).

---

## Module H — API Route Audit (build-breaking bugs first)

### H.0 — Pre-existing build break (baseline fix, required before any module)
- **What was broken**: `frontend/lib/inngest/functions.ts` (`warm-image-models` step)
  passed a `Buffer` directly as `fetch()`'s `body`, which fails `tsc` under
  Next.js 15's stricter `BodyInit` typing (`Buffer` is not `BodyInit`).
  `npm run build` failed at the type-check stage before any of the
  remediation work below could be verified.
- **Fix**: wrap the buffer in `new Uint8Array(...)` before passing to `fetch`.
- **File**: `frontend/lib/inngest/functions.ts` (~line 209).
- **Verify**: `cd frontend && npm run build` completes with no type errors.

### H.1 — Duplicate `export const maxDuration` in `detect/video/route.ts`
- **What was broken**: the file declared `export const maxDuration = 55` at
  the top of the file AND `export const maxDuration = 60` near
  `export const dynamic = 'force-dynamic'` — a duplicate-identifier error.
- **Fix**: removed the stray `= 55` declaration; kept `= 60` (video
  transcoding/frame analysis needs the longer budget).
- **File**: `frontend/app/api/detect/video/route.ts`.
- Searched the entire `frontend/app/api/**` tree for other duplicate
  `maxDuration`/`dynamic` exports in the same file — none found.

### H.2 — Mismatched rate-limit bucket in `detect/pdf/route.ts`
- **What was broken**: `checkRateLimitDB('video', ip)` was applied to the
  PDF/text detection route, borrowing the video bucket's 10/min limit for an
  unrelated modality.
- **Fix**:
  - Added a dedicated `pdf: { max: 15, windowMinutes: 1 }` entry to
    `DB_LIMITS` in `frontend/lib/ratelimit-db.ts`.
  - Changed `checkRateLimitDB('video', ip)` → `checkRateLimitDB('pdf', ip)`
    in `frontend/app/api/detect/pdf/route.ts`.
  - `creditGuard(req, 'text')` in the PDF route was already correct and left
    unchanged.

### H.3 — `/api/detect/*` and `/api/v1/*` contract audit
Audited every route listed in the prompt (`detect/{text,image,image-v3,audio,
video,pdf,web,batch,feedback}`, `v1/detect/text`, `v2/forensic-scan`,
`scan/[id]/{share,feedback}`, `pipeline/push`, `pipeline-stats`).

- **`detect/image/route.ts`**: the RAG-blended `finalVerdict`/`finalConfidence`
  (used when `DETECTION_RAG_ENABLED=true`) were written to the `scans` row but
  never returned to the client (the response spread the raw `result`, which
  still has the pre-RAG verdict/confidence). Now the response explicitly
  includes `verdict`, `confidence`, and `rag_stats`, matching the pattern
  already used by `detect/text/route.ts`.

- **`detect/web/route.ts`** (web/URL scanner):
  - `creditGuard(req, 'text')` → `creditGuard(req, 'url')`. `plan_limits` and
    `PLAN_MODALITIES` both define a separate `'url'` modality (Starter+ only,
    not on Free) — calling the guard with `'text'` let every plan (including
    Free) bypass that restriction entirely, since `'text'` is in every plan's
    modality list. The route now correctly returns `MODALITY_LOCKED` for Free
    users.
  - `checkRateLimit('text', ip)` → `checkRateLimit('scraper', ip)` — uses the
    rate-limit bucket that already exists specifically for this route's cost
    profile (5/min) instead of the generic text bucket (30/min).
  - Added a `fireScanCompleted` call after the scan row is inserted, so web
    scans now show up in the dashboard's real-time activity feed like every
    other modality.

- **`detect/batch/route.ts`**:
  - `creditGuard(req, 'text')` → `creditGuard(req, 'batch')`. `'batch'` is
    Pro/Enterprise-only in `plan_limits`/`PLAN_MODALITIES`; gating on `'text'`
    (available to every plan) meant Free/Starter users could call
    `/api/detect/batch` without ever hitting `MODALITY_LOCKED`.
  - `checkRateLimit('text', ip)` → `checkRateLimit('batch', ip)` (3/min vs
    30/min — batch is far more expensive per request).
  - `fireScanCompleted` was imported but never called — wired it up using the
    inserted scan row's id so batch runs now appear in the dashboard feed too.

- **`detect/feedback/route.ts`** and **`scan/[id]/{share,feedback}/route.ts`**:
  normalized every `{ success: false, error: 'some string' }` response to the
  standard `{ success: false, error: { code, message } }` envelope used
  elsewhere (`detect/text`, `detect/image`, etc.), so the frontend's generic
  error-toast handling works uniformly across all routes.

- **`v2/forensic-scan/route.ts`** (POST): this is an unauthenticated,
  expensive endpoint (uploads to R2, fires an Inngest cascade) with no
  `dynamic`/`maxDuration` exports and no rate limiting at all. Added
  `export const dynamic = 'force-dynamic'`, `export const maxDuration = 60`,
  and an IP-based `checkRateLimitDB('image', ip)` guard matching the cost
  profile of `/api/detect/image`. (Note: confirmed this POST route is not
  currently called from any frontend page — `/forensic/[scanId]` only uses
  the sibling `GET /api/v2/forensic-scan/[scanId]` for polling — but it's
  still a live, reachable endpoint and needed the same DOS protection as the
  rest of `/api/detect/*`.)

- **`pipeline/push/route.ts` / `pipeline-stats/route.ts`**: reviewed — these
  are internal/admin tooling endpoints with their own `{ ok, ... }` response
  convention (distinct from the public `{ success, ... }` envelope used by
  `/api/detect/*`). Left as-is; normalizing these into the detect-route
  envelope would risk breaking the admin dashboard's existing parsing and is
  out of scope for the user-facing detect-route contract this module targets.

- **`detect/image-v3/route.ts` decision (H.3 / C.2.3 dependency)**: confirmed
  this route (the standalone 6-layer Python CV pipeline caller) is **not**
  called by `app/(dashboard)/detect/image/page.tsx` (which only calls
  `/api/detect/image`) — it is dead code today. **Decision: option (a)** —
  its logic will be merged into `hf-analyze.ts`'s image ensemble as part of
  Module C (re-architecting the image scoring weights to be CV/Brain-first),
  and the standalone route will then be deleted per C.2.3. No code change in
  Module H beyond recording this decision; implementation happens in Module C.

- **`v1/detect/{image,audio}` — new routes (H.3 "pick one and make it true
  everywhere" for `/api/v1/detect/*`)**:
  - The only real discrepancy found: `app/(marketing)/docs/api/page.tsx`'s
    page `<meta description>` advertised "detecting AI text, images, audio
    and video" via the API, and ARIA's system prompt described only
    `/api/v1/detect/text`, while `/api/v1/detect/{image,audio,video}` did not
    exist. (The visible docs sections only covered `text`.)
  - **Decision**: implemented thin `/api/v1/detect/image` and
    `/api/v1/detect/audio` wrappers (multipart upload → `analyzeImage` /
    `analyzeAudio`, same API-key auth as `/api/v1/detect/text`), since both
    reuse existing buffer-based analyzers with no further engine work needed.
  - Extracted the API-key resolution/validation logic (SHA-256 + legacy djb2
    lookup, timing-safe compare, usage recording) out of
    `v1/detect/text/route.ts` into a shared `frontend/lib/api-v1/auth.ts`
    module, so all three v1 routes share identical, security-reviewed key
    handling instead of copy-pasting it.
  - **`/api/v1/detect/video` was *not* implemented**: `analyzeVideo()` without
    browser-extracted frames only returns a generic `UNCERTAIN` fallback
    ("Frame Extraction Required") — a public API wrapper around it would be
    low-value and misleading. Instead, updated all user-facing copy
    (`docs/api/page.tsx` meta description + new "coming soon" section,
    `README.md`, ARIA's system prompt in `app/api/chat/route.ts`) to
    accurately state that `/api/v1/detect/{text,image,audio}` exist today and
    video is dashboard-only / planned for the public API.
  - Also corrected ARIA's system prompt, which claimed "No authentication
    required for basic usage" — the route has always required `X-API-Key`
    (401 if missing). Now describes the real requirement.

### H.4 — `chat/route.ts` early-return hardening
- `if (!messages?.length) return new Response('Missing messages', { status: 400 })`
  → `NextResponse.json({ success: false, error: { code: 'NO_MESSAGES', message: 'Missing messages' } }, { status: 400 })`.
- The `if (!apiKey)` "ARIA not configured" fallback returned a plain JSON body
  (`{ text: '...' }`, `Content-Type: application/json`) while the rest of the
  route streams `text/event-stream` SSE frames (`data: {...}\n\n`). The chat
  page's stream parser expects SSE frames and would hang/error on this path.
  Now emits the same `{ type: 'text', text: '...' }` + `{ type: 'done' }` SSE
  frames as the normal streaming path, with the correct `text/event-stream`
  headers.

### Module H status: ✅ build green (`npm run build` succeeds, no type errors)

---

## Module G — Credits / Pro Plan Consumption Logic (CRITICAL BUG)

### Root cause
`check_and_increment_scan()` (v10) only ever decremented `profiles.credits_balance`
inside the "daily limit already exceeded → overage" branch. Under normal usage
no single user does 500 scans in one calendar day, so `credits_balance` was
**never decremented** — it stayed pinned at whatever value was set when the
plan was granted, while `user_scan_counts.daily_count` reset to 0 every
midnight via the `reset-daily-scan-counts` cron. The "Scan Credits" usage bar
therefore permanently showed `0 / 500 used (0%)`.

Separately, `/api/user/credits/route.ts` computed `creditsUsed` from a
month-filtered `credit_transactions` sum (`creditsGranted - balance`). If the
plan was granted in a prior calendar month, `creditsGranted` for *this* month
is `0`, so `creditsUsed` was always `0` regardless of the actual balance —
a second, independent reason the usage bar always read 0%.

### G.1 — New migration: `supabase/migrations/v16_credit_metering_fix.sql`
**⚠️ This SQL migration must be run manually in the Supabase SQL Editor — it
is not auto-applied.**

- Added `profiles.credit_period_start` / `profiles.credit_period_end`
  (`TIMESTAMPTZ`), backfilled for existing paid users from `plan_updated_at`
  (or `NOW()` if never set) + 1 month.
- `plan_limits.daily_scans` for `'pro'` changed from `500` → `200`. Under the
  new model `credits_balance` (500/month) is the real quota; `daily_scans` is
  now purely an anti-abuse throttle so a script can't burn the entire monthly
  pool in one sitting, while staying far above any human's normal daily use.
  `free` (10/day, no credits), `starter` (100/day, matches its 100
  credits/month), and `enterprise` (`-1` = unlimited) were left unchanged.
- **Rewrote `check_and_increment_scan(p_user_id, p_media_type)`**:
  - New return columns: `credits_remaining INTEGER`, `credit_period_end
    TIMESTAMPTZ` (previously the function returned neither, so
    `credit-guard.ts`'s `result.credits_remaining` read was always
    `undefined`).
  - **`free` plan**: unchanged daily-limit-only behavior, no credit balance
    touched.
  - **Paid plans** (`starter`/`pro`/`enterprise`):
    1. Modality check (unchanged).
    2. **Primary check**: `credits_balance >= credits_per_scan`. If not →
       `modality_credits_exhausted` (this reason already existed in
       `credit-guard.ts`'s `mapDenyCode`, it just could never be reached
       before).
    3. **Secondary check** (anti-abuse): `daily_count >= daily_scans` (unless
       `-1`). If exceeded → `daily_limit_reached`.
    4. Otherwise: decrement `credits_balance` by `credits_per_scan`
       (unconditionally, every scan — not just on overage), increment
       `daily_count`, return `allowed = true` with the new
       `credits_remaining`.
  - Removed the old `credit_overage` reason/branch entirely — credits are now
    always the primary gate, so "overage" (continue scanning past the daily
    limit by spending credits) no longer applies; once `daily_scans` is hit
    for the day, the user simply waits until tomorrow (credits are preserved).
  - Audited every `cron.schedule` across `supabase/migrations/*.sql`:
    confirmed `reset-daily-scan-counts` (the only cron) only `DELETE`s from
    `user_scan_counts` and never touches `credits_balance`/`credits_remaining`.
    Nothing to remove.

### G.1.5 — `credits_balance` vs `credits_remaining` de-duplication
Kept both columns (the `v14_admin_credits_rpc.sql` `trg_sync_credits` trigger
already mirrors every write between them at the Postgres level, and confirmed
`authDb()` in `lib/db/saga.ts` points at the **same** Supabase Postgres
database as `getSupabaseAdmin()` — so the trigger fires for raw-SQL writes
too, no second desync bug). **`credits_balance` is now the canonical column**
for all new/updated code:
- `frontend/lib/db/saga.ts` `topUpCreditsStep` now reads/writes
  `credits_balance` (was `credits_remaining`).
- `frontend/lib/db/saga.ts` `deductCreditStep`'s `compensate()` previously
  referenced non-existent `profiles.daily_scans` / `profiles.scan_count`
  columns (this whole `runCreateScanSaga`/`deductCreditStep` path is unused
  dead code today, but was fixed to refund `credits_balance` correctly in
  case it's wired up later).
- **Found and fixed a second, unrelated critical bug while in this file**:
  `recordCreditPurchaseStep` (used by `runCreditPurchaseSaga`, called from
  the XPay webhook on every successful payment) inserted into
  `credit_transactions` columns `delta`/`reason` which **do not exist** in
  the v10 schema (`credit_transactions` has `credits`/`metadata`, not
  `delta`/`reason`). This INSERT would throw on every real XPay purchase,
  failing the whole saga before `credits_balance` was ever topped up — i.e.
  **paying customers' credit purchases were silently failing at the DB
  layer**. Fixed the INSERT to use the real v10 columns
  (`credits`, `metadata` jsonb).

### G.2 — `frontend/app/api/user/credits/route.ts`
- `creditsUsed` is now `Math.max(0, planCfg.total_credits - balance)` — a
  direct subtraction, always correct regardless of which month the plan was
  granted. Removed the `credit_transactions`-sum (`creditsGranted`/
  `creditsConsumed`) calculation entirely (it was unused for anything else in
  this response).
- `credits_pct = Math.round((creditsUsed / credits_total) * 100)`, using the
  corrected `creditsUsed`.
- `PLAN_LIMITS.pro.daily_scans` updated `500 → 200` to match the v16
  migration.
- Now selects and returns `credit_period_start` / `credit_period_end` from
  `profiles` (G.1.4) so the profile page can render "Resets on <date>".
- Normalized the two error responses to `{ success: false, error: {code,
  message} }`.

### G.3 — `frontend/app/(dashboard)/profile/page.tsx` "Scan Credits" UsageBar
- `CreditsData` type extended with `credit_period_start`/`credit_period_end`.
- Added a `formatResetDate()` helper (`"Jul 15, 2026"` style).
- "Scan Credits" `sublabel` changed from the inaccurate hardcoded
  `"Resets with your plan · used for audio & video"` (credits now meter **all**
  modalities, per G.1) to `` `Resets ${formatResetDate(credit_period_end)}` ``,
  falling back to the old generic string only if the period isn't set
  (shouldn't happen post-migration for paid users).
- "Daily Scans" bar: for paid plans (`is_paid`), relabeled to **"Daily
  Activity (abuse protection)"** and given a muted gray accent (`#64748b`)
  instead of cyan, since it's now a secondary throttle, not the user's real
  quota. Free-tier users still see "Daily Scans" in cyan as their primary
  limit (unchanged).

### G.4 — Admin panel (`admin/app/api/users/[id]/{plan,credits}/route.ts`)
- `admin/.../plan/route.ts`: `PLAN_CONFIG.pro.daily_scans` updated `500 → 200`
  (matches v16/G.2). On every plan change, now sets
  `credit_period_start = NOW()` and `credit_period_end = NOW() + 1 month`
  (or both `null` for a downgrade to `free`, which has no credit balance).
- `admin/.../credits/route.ts` (manual `delta` credit grants): if the user
  has no `credit_period_end` yet (e.g. a free user receiving their first
  manual grant), starts a fresh 1-month period. If a period is already
  active, a top-up does **not** push the renewal date out — only a real plan
  change/renewal does that.

### G.1.3 — `frontend/app/api/webhook/xpay/route.ts`
On every successful XPay payment (the only "genuine renewal event" in this
codebase), now also sets `credit_period_start = NOW()` and
`credit_period_end = NOW() + (1 month or 12 months for yearly plans)` on the
profile, alongside the existing `plan`/`plan_period`/`plan_updated_at` update.
`runCreditPurchaseSaga`'s `topUpCreditsStep` remains **additive**
(`credits_balance += credits`) rather than a hard reset — this was a
deliberate choice to avoid wiping out a user's unused balance on what might be
a one-time top-up purchase rather than a subscription renewal; XPay's webhook
payload doesn't currently distinguish the two. Documented here as a follow-up
candidate if "no credit rollover" becomes a hard product requirement.

### Module G status: ✅ both `frontend` and `admin` build green
(`npm run build` in both, no type errors).

**Action required from Anas**: run
`supabase/migrations/v16_credit_metering_fix.sql` in the Supabase SQL Editor
for the Aiscern project before this takes effect in production.

---

## Module C — Image detection layer re-weighting (not started yet — includes
the `image-v3` merge/delete decided above in H.3)
## Module F — Settings persistence (not started yet)
## Module B — Auth pages redesign (not started yet)
## Module D — Bright tool-card accents / anti-vibecode pass (not started yet)
## Module E — Mobile responsiveness sweep (not started yet)
