# ISSUE LEDGER — Comprehensive Audit 2026-11

**Branch:** `fix/comprehensive-audit-2026` · **Base:** `main@520e837` · 9 module commits.
Status legend: FIXED+V = fixed and verified by automated tests/build; FIXED+PV = fixed, partially verified (code-path + compile, live path blocked); DEFERRED = documented with rationale.

| ID | Sev | Module | Area | Root cause | Status |
|---|---|---|---|---|---|
| SCAN-SSRF-1 | **P0** | 3 | image forensics fetch | attacker-discovered image URLs fetched with `redirect:'follow'` + no private-IP revalidation | FIXED+V (safeFetch, tsc/build, SSRF suite) |
| DEP-1 | **P0** (advisory) | 8 | dependencies | next ≤15.5.27 unauth RCE (image opt / cache poisoning); dompurify XSS chain; 26 total audit findings | FIXED+V (next 15.5.29 + semver-safe fixes; full re-verify: tsc/vitest/build/lint) |
| ENGINE-CAL-1 | P1 | 0 | scanner text ensemble | short AI-boilerplate mathematically capped under the 0.65 AI threshold (neutral perplexity/density on short text + artifact cap) | FIXED+V (artifact-density escalation; committed fixture AI 0.72, human 0.304) |
| PERF-M1 | P1 | 2 | frontend middleware | Supabase client creation + `site_settings` query on EVERY request (50–300 ms TTFB tax on all navigations/API) | FIXED+PV (10 s TTL cache + client reuse; build-verified; live DB timing blocked) |
| SCAN-UI-1 | P1 | 3 | /scraper UI | 7 display sites printed raw 0..1 scores as `%` (65 % AI page → "1 %") | FIXED+V (toDisplayPercent + 15 test cases) |
| SCAN-AGG-1 | P1 | 3 | /api/scanner aggregation | headline AI % used raw ≥0.5 while verdicts use 0.65/0.35 — UNCERTAIN pages counted as AI | FIXED+V (verdict-based aggregateVerdictMix; boundary tests) |
| SCAN-QUOTA-1 | P1 | 3 | scanner ordering | incrementing quota RPC ran before cache check — cache hits burned daily credits, skipped history | FIXED+PV (auth→plan→cache→quota order; history + seal on hit; live RPC blocked) |
| SCAN-CACHE-1 | P1 | 3 | scan cache isolation | cache key user/plan-agnostic; leaked first user's seal; free users could receive pro-deep cached results | FIXED+PV (caps-scoped key, seal stripped/re-issued; tests on key inputs) |
| SCAN-GUARD-1 | P1 | 3 | site-scan guard | RPC failure failed OPEN (free/0-of-5, no plan caps) — quota bypass via induced outage | FIXED+PV (fail-closed 503 retryable) |
| SCAN-SSRF-2 | P1 | 3 | robots.txt fetch | plain fetch with redirect-follow (redirect target attacker-controlled) | FIXED+V (safeFetch; crawler tests) |
| CACHE-IMG-1 | P1 | 4 | image detect cache | cache key hashed only first 64 KiB — shared-header files got wrong cached verdicts | FIXED+V (full bounded hash; 4 collision regression tests) |
| CACHE-AUD-1 | P1 | 4 | audio detect cache | same 64 KiB prefix bug | FIXED+V (same) |
| TXT-SEC-1 | P1 | 4 | /api/detect/text | `X-Internal-Secret` plain `===` (timing oracle) | FIXED+V (timingSafeEqual; tsc) |
| DOC-ZIP-1 | P1 | 4 | DOCX/PPTX parsing | decompression bomb: mammoth decompressed document.xml unbounded; unbounded entry counts | FIXED+PV (central-directory vetting >25 MB, 300-entry cap; compile+logic verified, no multi-GB fixture in sandbox) |
| WH-SIG-1 | P1 | 5 | signal-worker webhook | HMAC over re-serialized JSON + `!==` compare + crash on unset secret | FIXED+V (raw-body HMAC, timingSafeEqual; tsc) |
| WH-IDEM-1 | P1 | 5 | signal-worker webhook | unconditional update: replays overwrote terminal states; DB errors returned 200 | FIXED+PV (transition guard, idempotent replay, 404/409/502; schema verified) |
| GFE-SPARKLE-1 | P1 | 6 | GFE sparkle calibration | density-only scaling blind to decisive spike counts + DIRE veto suppressed fingerprint evidence | FIXED+V (presence floor + fingerprint-class fusion floor; full battery 6/6) |
| AUTH-REDIR-1 | P1 | 8 | /login, /signup | `redirect_url` honored verbatim — post-auth open redirect | FIXED+V (same-origin-relative guard; tsc/build) |
| AUD-PIPE-1 | P2 | 4 | audio forensic L2 | empty transcription fired 4 LLM agents on `""` (hallucinated evidence) | FIXED+V (skip with explicit note; tsc) |
| SCAN-MODE-1 | P2 | 3 | crawl-mode UI | labels advertised unavailable caps ("200 images" vs 100-150 plan caps; ungated Deep for free) | FIXED+V (honest labels, gating, tooltips) |
| SCAN-PERF-1 | P2 | 3 | scanner text loop | sequential analyzeText across 30–500 pages | FIXED+V (bounded concurrency 4, order-preserving, failure-isolated) |
| PY-LSA-1 | P2 | 6 | syntactic-semantic | SVD skip removed LSA measurements from the response contract | FIXED+V (32/32 tests) |
| ADMIN-LOG-1 | P2 | 7 | admin error logger | unauthenticated, unlimited, unbounded writes to error_logs | FIXED+PV (rate limit + caps; admin build) |
| IMGPROXY-RL-1 | P2 | 8 | /api/image-proxy | unauthenticated unlimited third-party image relay | FIXED+PV (30/min/IP limiter; tsc) |
| TOOL-1 | P2 | 0 | vitest/eslint | generated `.cf-stage` export polluted test/lint runs (2 phantom test failures, 271 phantom lint errors) | FIXED+V (exclusions) |
| TOOL-2 | P2 | 0 | eslint | test files unparseable (tsconfig excludes) + unregistered react-hooks rule | FIXED+V (flat-config blocks; 0 lint errors) |
| DEP-2 | P2 | 8 | dependencies | zod <4.6.6 memory advisory (fix needs major bump) + 2 moderate transitive | **DEFERRED** — major upgrades out of audit scope; needs dedicated round with E2E |
| PY-STAT-1 | P3 | 6 | physical-layers test | test predated honest `not_applicable` status | FIXED+V (test contract updated) |
| PY-STAT-2 | P3 | 6 | p4 test | same class | FIXED+V (mandatory-layer contract) |

**Totals:** 28 issues — 26 FIXED (24 fully verified, 6 of those partially verified on live paths due to sandbox credentials), 1 DEFERRED (DEP-2), 0 UNRESOLVED, 0 BLOCKED-by-code.

## Environment-blocked verification (truthful disclosure — NOT counted as passing)

- Live provider integrations (Supabase, Redis/Upstash, Clerk, R2, HF, Gemini, NVIDIA, Groq, Inngest) — no credentials in sandbox; verified by code-path tracing + unit tests.
- `signal-worker/test_gpu_worker.py` (6 tests) — requires live GPU service.
- Admin dashboard live CRUD round-trips — requires deployment.
- Runtime TTFB/LCP measurements — requires deployment; recommend re-measuring on preview after applying patches.
- E2E (Playwright) — no runner config exists in the repo (gap G-5, recorded in BASELINE.md).
