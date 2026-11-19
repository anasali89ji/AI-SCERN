# WEB SCANNER AUDIT (Module 3)

**Scope:** `/scraper` UI → `/api/scanner` → `lib/scanner/*` (crawler, engines, duplicity, image-forensics, trust, stylometry, wordpress, perplexity) → cache/quota/seal/persistence.

## Canonical implementation (verified call graph)

`/scraper` page (nav "Web Scanner") → `POST /api/scanner` → `crawlSite()` (sitemap-first + BFS, 4–8 workers, robots-respecting) → `analyzeText()` ensemble + `analyzeStylometry` per page → `analyzeDuplicity` site-wide → `analyzeImagesBatch` (concurrency 8) → cross-correlation (text 65 / image 35) → `buildSiteTrustScore` → aggregation → `issueIntegritySeal` (SHA-256) + `issueSealForSiteScan` (ASC-… seal number) → `scans` history insert → 1 h scan cache. Legacy `/scanner` page redirects to `/scraper` (correct). **Not live:** `/api/scraper` (legacy Gemini scanner, zero UI callers), `lib/site-crawler/*` except `integrity-seal.ts` (used here) and `site-scanner.ts` (used by `/api/detect/site`).

Previously-fixed-and-verified (earlier rounds, confirmed still in place): SSRF resolved-variant guard on entry URL + `safeFetch` for pages/sitemaps (`SCANNER-SEC-1`), first-success fetch race (`SCANNER-RACE-1`), crawl-hang termination (`SCANNER-HANG-1`), robots.txt respect + Redis cache, bounded crawl concurrency, per-plan caps via RPC (v36), SHA-256 seal, history persistence.

## Issues found, fixed and regression-tested this round

| ID | Severity | Area | Root cause | Fix | Verification |
|---|---|---|---|---|---|
| SCAN-UI-1 | **P1** | `/scraper` result UI | 7 display sites printed raw 0–1 engine scores next to a `%` label (`Math.round(0.65)` → "1%"): originality, voice diversity, transparency, link trust, page aiScore, content depth, image aiScore | all go through `toDisplayPercent()` (`lib/scanner/aggregate.ts`), which clamps + ×100 | new `aggregate.test.ts`: values 0.03/0.35/0.5/0.65/0.95/0.655/1/0 + invalid inputs; 77/77 tests pass |
| SCAN-AGG-1 | **P1** | `/api/scanner` aggregation | headline `aiContentPercent` counted raw score `>= 0.5` as AI while page verdicts use `>= 0.65` — every 0.5–0.65 UNCERTAIN page inflated the headline AI share; heatmap had the same defect | `aggregateVerdictMix()` derives AI/HUMAN/UNCERTAIN shares from page **verdicts**; heatmap counts verdict==='AI' | new tests: 0.5/0.64 pages are NOT AI; verdict-derived mix; failed pages excluded from denominator |
| SCAN-QUOTA-1 | **P1** | `/api/scanner` ordering | `siteScanGuard()` (incrementing RPC) ran **before** the cache lookup — a cache hit burned a daily-scan credit without performing work, and the cache-return branch skipped the history insert | route order now: rate-limit → **auth only** → URL/SSRF → **plan context (non-mutating)** → cache check → (hit: history + fresh seal for the requesting user, no credit) → (miss: incrementing guard → scan) | code-path contract documented in `site-scan-guard.ts` header; type-check + build + full suite green |
| SCAN-CACHE-1 | **P1** | scan-cache isolation | cache key was `hash(url+mode)` — user- and plan-agnostic. A free user could receive a cached 500-page pro-deep result (entitlement bypass) and any user could receive **another user's seal number** (user-specific artifact leak) | key now includes the plan-effective page/image caps; the cached payload has its seal stripped; cache-hit path re-issues the seal in the requesting user's name | cache-hit branch re-issues seal + inserts history (`from_cache: true`); unit tests for key inputs (caps scoping); build green |
| SCAN-GUARD-1 | **P1** | quota guard | RPC failure failed OPEN with a permissive `free/0-of-5` fallback — induced RPC errors granted unlimited scans with no plan caps | fail CLOSED: 503 `QUOTA_SERVICE_UNAVAILABLE`, retryable message; rate limiter still bounds retry pressure | guard rewrite; both RPC-error and empty-result paths covered |
| SCAN-SSRF-1 | **P0** | image forensics fetch | image URLs (attacker-controlled, discovered in scanned HTML) were fetched with plain `fetch` + `redirect:'follow'` — an image URL 302-ing to `169.254.169.254` was followed silently | both fetch attempts go through `safeFetch` (manual redirects, per-hop DNS + private-range revalidation) | type-check; existing 22-test SSRF suite still green (safeFetch covered there) |
| SCAN-SSRF-2 | **P1** | robots.txt fetch | plain `fetch` with redirect-follow on the same origin (redirect target is still attacker-controlled) | `safeFetch` | type-check + crawler tests green |
| SCAN-MODE-1 | **P2** | crawl-mode UI/contract | UI advertised "Deep · 150 pages/200 images" with no gating while free plan clamps to 30 pages / starter images cap at 100; Pro button said "+100 images" vs actual 150 | honest labels ("Deep · up to 150"), Deep disabled for free plan via `plan` from `useUserPlan` with explanatory tooltip, Pro description corrected to 150 images, header text corrected | type-check + build; server caps unchanged (RPC remains source of truth) |
| SCAN-PERF-1 | **P2** | per-page text analysis | `analyzeText` awaited sequentially — 150–500-page scans serialized ~1–3 ms/page of pure-JS work | `analyzeAllPages()`: bounded concurrency 4, **index-assigned** (order-preserving), per-page failure isolation (failed page excluded from verdict mix, flagged in findings) | full suite green; ordering by construction (no array race) |
| ENGINE-CAL-1 | **P1** | text ensemble (fixed in Module 0) | short AI-boilerplate mathematically capped below the 0.65 AI threshold (see BASELINE.md §5) | artifact-density escalation (≥6 signature phrases/100 words + ≥1 high severity → floor 0.72) | committed fixture now AI/0.72; human fixture unchanged 0.304 |

## Score/result contract (now explicit)

- `aiScore`, `confidence`, `contentDepthScore`, `contentOriginalityScore`, `voiceDiversityIndex`, `transparencyScore`, `linkTrustScore`, image `aiScore`: **0–1** model scores.
- `aiContentPercent`, `humanContentPercent`, `uncertainContentPercent`, `aiImagePercent`, heatmap `aiContentPercent`: **0–100** percentages, derived from **verdicts** (thresholds: AI ≥ 0.65, HUMAN ≤ 0.35).
- UI percentages: `toDisplayPercent(score01)` — clamps, ×100, rounds at presentation only.
- Failed analyses: excluded from mix denominators, reported as `failedPages`/`fetchStats.failed` — never silently scored as HUMAN or 0.
- Quota semantics: fresh scan consumes 1 daily credit + writes history; cache hit consumes **no** credit, still writes history (`from_cache: true`) and re-issues the seal for the requesting user.

## Crawler/robots/canonicalization — verified behaviors (no defects found)

Sitemap index (≤3 sub-sitemaps) + urlset, foreign-host `<loc>` allowed but SSRF-guarded, same-host queue filter; robots wildcard + AiscernBot groups with Disallow-prefix matching, Redis 1 h cache, fail-open on unreachable robots (correct — unreachable robots must not block a public scan); BFS priority queue with Set-based dedup; per-page noise/content selectors; lazy-image extraction (`srcset`/`data-*`/`<noscript>`/CSS backgrounds), tracking-pixel filter; WordPress fingerprinting; `MAX_IMAGES_PER_PAGE` 40.

## Not fixable / deferred

- **JS-rendered sites:** crawler is static-HTML + Jina reader fallback; the UI/`fetchMethod` honestly labels which method served each page. No headless-browser rendering is advertised or implemented — matches the current honest contract.
- **Live end-to-end scan against a real site** (network + quota + seal persistence): blocked in sandbox (no Supabase/Clerk/Upstash credentials). The controlled-fixture E2E journey is queued for Module 9 (Playwright config does not exist yet — G-5).
- Domain-age trust metric remains a documented placeholder (`domainAgeScore = 40` — would need WHOIS); labeled as such in results (`siteTrustScore`).

## Verification summary

- `npx vitest run` → **7 files / 77 tests pass** (new `aggregate.test.ts` + existing crawler/engines/ssrf/pdf/cache/brain suites).
- `npx tsc --noEmit` → PASS. `npm run lint` → 0 errors. `npm run build` → PASS.
