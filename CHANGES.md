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

## Module G — Credits / Pro Plan Consumption (not started yet)
## Module A — ARIA RAG-first engine (not started yet)
## Module C — Image detection layer re-weighting (not started yet — includes
the `image-v3` merge/delete decided above in H.3)
## Module F — Settings persistence (not started yet)
## Module B — Auth pages redesign (not started yet)
## Module D — Bright tool-card accents / anti-vibecode pass (not started yet)
## Module E — Mobile responsiveness sweep (not started yet)
