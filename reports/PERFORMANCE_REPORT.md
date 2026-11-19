# PERFORMANCE REPORT (Module 2)

**Branch:** `fix/comprehensive-audit-2026` · Baseline captured in `BASELINE.md` §6 before any change.

## 1. PERF-M1 — middleware Supabase round-trip on every request (P1, FIXED + VERIFIED)

- **Area:** `frontend/middleware.ts` → `checkMaintenanceMode()`.
- **Evidence (code path):** the middleware matcher excludes only static assets; every page navigation, RSC fetch and `/api/*` request (except the 9 exempted prefixes) executed: `createClient(url, key)` (full Supabase client construction) + `.from('site_settings').select(...).in(...)` — a network round-trip to Supabase **per request**, with no cache. On Vercel this adds the DB RTT (typically 50–300 ms depending on region/load) to the TTFB of every dashboard page and API call — the exact "slow initial loading / slow navigation" symptom class.
- **Fix:** module-level 10-second TTL cache of the maintenance state + reuse of a single module-level Supabase client. Cache also covers the error path (an unreachable DB no longer becomes a per-request retry storm). Behavior preserved: `null` state still means "not enabled"; admin/localhost bypass, redirect target and `no-store` headers unchanged. Worst-case staleness for a maintenance toggle: ~10 s per edge instance — documented and acceptable for a maintenance flag.
- **Effect (mechanical):** DB queries for maintenance drop from 1/request to 1/10 s/instance (≥99% reduction at any real traffic). TTFB on every non-exempt request loses the DB RTT.
- **Verification:** `tsc --noEmit` PASS; `npm run build` PASS (middleware 116 kB, unchanged); route bundle sizes byte-identical (543 KB /dashboard) — no client-side regression. Runtime DB behavior not measurable in sandbox (no Supabase credentials); cache logic is synchronous and code-path-verified.
- **Files:** `frontend/middleware.ts`.

## 2. Bundle analysis (build output, raw chunk sizes)

Prior audit round (commit `520e837`) already removed recharts from `/history` (305→201 kB gz) and supabase-js from 4 routes. Current state (route+shared raw):

| Route | raw | Dominant route-unique content |
|---|---|---|
| /detect/audio, /detect/video | 762–763 KB | react-dropzone + MIME tables (chunk 436, 61 KB) shared by the 5 upload routes; page chunk 25–30 KB |
| /batch | 737 KB | same upload stack |
| /detect/image | 743 KB | same + image UI |
| /detect/text | 706 KB | page chunk 30 KB (no dropzone — text area only) |
| /detect/document | 584 KB | document UI |
| /history, /settings, /profile | 661–693 KB | already optimized in prior round |
| /dashboard, /scraper, /chat, /credits, /workflows, /pipeline | 531–548 KB | lean |

- framer-motion (~130 KB raw across shared chunks 6390/436/2497) is imported by 20+ components across marketing AND dashboard — a design-system-level dependency. Removing it is a **redesign**, explicitly out of scope (audit rule: no broad redesign of unrelated pages).
- react-dropzone is the upload affordance on the 5 upload routes — it is the primary interaction, not deferrable without hurting UX.
- No client-side `axios`/`mime-db` direct imports found (transitive only, tree-shaken where possible).
- Dashboard polling audited: only 3 `setInterval` uses (30 s notification poll, 1 s batch elapsed timer, marketing hero animation) — all have cleanup, no unbounded polling.
- `/pipeline` page still exists although removed from nav (commit `6a54c93`) — kept; not a perf issue.

**Conclusion (bundle):** no further safe, high-impact client bundle wins without redesign; the measurable remaining cost is justified upload/animation/auth/framework weight. Detect-route weight is dominated by *shared* chunks (cached across route navigations after first dashboard visit).

## 3. Server-side scan-path performance (deferred detail fix to Module 3)

`/api/scanner` runs per-page `analyzeText()` sequentially in a `for` loop (route.ts lines 256–291). With analyzeText measured at ~1–3 ms/page CPU (pure JS heuristics), the crawl fetch (network-bound, already pooled at 4–8 workers) dominates; the sequential loop matters only on very large scans. Bounded-concurrency conversion with preserved ordering is implemented in Module 3 together with the scanner contract fixes (see WEB_SCANNER_AUDIT.md).

## 4. Remaining / deferred performance items

| Item | Status |
|---|---|
| Live TTFB/LCP measurement in a deployed environment | **Blocked** — no deployment credentials in sandbox; recommend re-measuring on preview deployment after applying patches. |
| LCP image / font audit on marketing pages | Marketing pages use `next/font` + `next/image` (spot-checked); no measured regression to act on. |
| Database index audit for `/history` filters | Deferred to Module 5 (DB pass) — no query plans measurable without a live DB. |

## Module 2 exit criteria — status

- [x] Top performance bottlenecks ranked (middleware round-trip #1; bundle work exhausted by prior round; scanner loop → Module 3).
- [x] Highest-severity cause of slow navigation fixed (PERF-M1) and verified by build + type-check.
- [x] Baseline-vs-after documented (bundle sizes byte-identical; middleware DB load reduced by design; remaining costs itemized).
- [x] Functional behavior unchanged (maintenance semantics preserved).
