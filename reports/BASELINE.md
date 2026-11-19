# BASELINE — Repository Bootstrap and Local Baseline (Module 0)

**Date:** 2026-11-18
**Auditor:** Z.ai coding agent (comprehensive audit round 2026-11)
**Repository:** `https://github.com/anasali89ji/AI-SCERN` (verified: `git remote -v` → `origin https://github.com/anasali89ji/AI-SCERN.git`)
**Source branch:** `main`
**Starting commit:** `520e837404f4b332f01d93bd444bbdfbd4ba25ef` (`perf(dashboard): cut initial JS on the 5 heaviest customer routes`)
**Working branch:** `fix/comprehensive-audit-2026` (created from `main` at the commit above)
**Safety checkpoint:** local tag `checkpoint-pre-audit-2026` (new tag, nothing overwritten)
**Pre-existing changes:** none — `git status` was clean at clone time.
**Runtime:** Node v24.22.3, npm 11.19.1, Python 3.12.16, pytest 9.0.2 (Linux sandbox).

---

## 1. Monorepo / workspace map (verified from lockfiles + configs, not docs)

| Area | Stack | Lockfile | Notes |
|---|---|---|---|
| `frontend/` | Next.js 15 (App Router), React, Clerk auth, Supabase, Tailwind | `package-lock.json` | Customer-facing app + `/api/*` routes. `engines: node 24.x`. |
| `admin/` | Next.js 14.2, SWR, recharts | `package-lock.json` | Separate admin dashboard app. |
| `cf-pipeline/` | Cloudflare Workers (TypeScript, wrangler 4) | `package-lock.json` | 18 wrangler configs (a–p variants + ratelimit). |
| `cf-workers/`, `cloudflare-worker/`, `cloudflare-worker.ts` | Worker/LB/proxy | mixed | Which are live vs legacy — to be determined in Module 6. |
| `signal-worker/` | Python (Flask-style `app.py` + analyzers) | `requirements*.txt` (3 variants) | CPU/GPU/HF-ZeroGPU deployment variants. |
| `supabase/migrations/` | SQL | — | 36+ numbered migrations, source of truth for schema. |
| `frontend/.cf-stage/` | **Generated staging export** (`aiscern-marketing`) | none (uses parent's) | Marketing-only subset (legal+marketing routes). **Tracked in git, drifted from canonical source.** Excluded from vitest/eslint in this audit (see §4). |
| Root | `package.json` (helper scripts) | `package-lock.json` | Orchestration only. |

### Duplicated / legacy implementations identified at baseline

- `frontend/app/api/scraper/route.ts` (440 lines) — **legacy Gemini-based site scanner**. No frontend caller (UI calls `/api/scanner`); referenced only by a `maxDuration` override in `vercel.json`. Canonical scanner is `/api/scanner` + `lib/scanner/*`.
- `frontend/lib/site-crawler/*` — older site-scanner implementation family (integrity seal is imported by the live `/api/scanner`; rest to be traced in Module 1).
- `frontend/app/(dashboard)/scanner/page.tsx` — legacy route that redirects to `/scraper` (correct canonical behavior).
- `frontend/.cf-stage/` — deployment export; must not be treated as runtime source.

---

## 2. Baseline command results (before any fixes)

### frontend/

| Command | Result | Notes |
|---|---|---|
| `npm ci` | **PASS** | 1.5 GB node_modules; some peer-dep warnings (pre-existing). |
| `npm run type-check` (`tsc --noEmit`) | **PASS (exit 0)** | Canonical source only. NOTE: `tsconfig.json` excludes `**/*.test.ts` and `e2e/` — tests are not type-checked (coverage gap, G-1). |
| `npm run lint` | **FAIL → see §4** | 280 errors / 129 warnings at baseline. 271 of the errors were parser errors caused by tooling scanning `.cf-stage/**` (generated export with its own tsconfig) and test files excluded from tsconfig. After excluding `.cf-stage` and giving tests a project-less parse config: **0 errors / 126 warnings** (`--max-warnings 999` in the script, so exit 0). |
| `npm run test` (`vitest run`) | **FAIL → see §3** | Baseline: 2 failed / 88 passed (plus the same 2 failures duplicated from `.cf-stage`'s stale copy = 4 failing test entries). After `.cf-stage` exclusion: **2 failed / 62 passed**. The 2 real failures are the engine calibration defect ENGINE-CAL-1 (fixed in this module, see §5). |
| `npm run build` | **PASS (exit 0)** | Full production build. Route sizes captured in §6. |

### admin/

| Command | Result | Notes |
|---|---|---|
| `npm ci` | **PASS** | |
| `npm run build` | **PASS (exit 0)** | `/dashboard` 94.6 kB First Load JS; middleware 90.5 kB. |
| `npm run lint` | **BLOCKED** | No ESLint config exists — `next lint` drops to an interactive setup prompt. Recorded as coverage gap (G-2). |
| type-check | **BLOCKED** | No `type-check` script and no `tsc` devDependency declared (uses the build's internal check only). Gap (G-3). |

### cf-pipeline/

| Command | Result | Notes |
|---|---|---|
| `tsc --noEmit -p tsconfig.json` | **PASS (exit 0)** | Required installing `@cloudflare/workers-types` (installed with `--no-save`; lockfile untouched). |
| tests | **none exist** | No test script, no test files (gap G-4). |
| `wrangler deploy --dry-run` | **NOT RUN** | Wrangler not installed (heavy dependency); validation deferred to Module 6. |

### signal-worker/ (Python)

| Command | Result | Notes |
|---|---|---|
| `python3 -m pytest tests/ -q` | **426 collected: 404 passed, 22 failed, 1 skipped** (207s) | Full breakdown in §3. `tests/test_accuracy.py` excluded from the quick pass (long-running; see §3). |
| deps | Partially installable | `pip install -r requirements.txt` fails in this sandbox (No space left on device — torch-class wheels). System numpy + `PyWavelets` (installed, ~2 MB) cover the test suite. |

---

## 3. Baseline test failures (inventory, pre-fix)

Real failures in the canonical tree (each gets an issue ID in `ISSUE_LEDGER.md`):

| Test | Error | Category |
|---|---|---|
| `frontend/lib/scanner/__tests__/engines.test.ts > detects AI-like text with artifacts` | `expected 'UNCERTAIN' to be 'AI'` | **ENGINE-CAL-1** — text ensemble cannot flag short AI-boilerplate (root cause + fix in §5). |
| `signal-worker/tests/test_syntactic_semantic_features.py::test_lsa_block_is_provisional_and_unscored` + `::test_lsa_reports_real_measurements` | `KeyError: 'lsa'` / missing provisional fields | **PY-LSA-1** — `_LSA_SCORING_ENABLED=False` skip removed the measurement block the response contract requires. Fix in Module 6. |
| `signal-worker/tests/test_physical_layers.py::test_layer_reports_schema` | `assert 'not_applicable' in ('success','failure')` | **PY-STAT-1** — tests predate the honest `not_applicable` layer status. Test-side drift. Module 6. |
| `signal-worker/tests/test_p4_detectors.py::test_all_7_layers_fire_via_bytes_path` | requires every layer `status == 'success'` | **PY-STAT-2** — same class: new layers legitimately report `not_applicable` on a 64×64 noise PNG. Module 6. |
| `signal-worker/tests/test_gfe.py` (5 failures at baseline) | `ModuleNotFoundError: No module named 'pywt'` | **ENV** — missing PyWavelets in sandbox; after `pip install PyWavelets`, 4 of 5 pass. 1 remaining: `test_ai_images_detected[7-dark scene with sparkles]` — real detector sensitivity issue, Module 6. |
| `signal-worker/tests/test_accuracy_fixture.py::test_modality_accuracy_at_floor[image]` | `pywt` (fixed by install) — passes after | ENV. |
| `signal-worker/tests/test_module1_module2_regression.py::TestModule2FormatPriorVariance::test_score_variance_across_distinct_png_content` | passes after pywt install | ENV. |
| `signal-worker/tests/test_gpu_worker.py` (6 failures) | `requests.exceptions.ConnectionError` | **ENV-BLOCKED** — requires a live GPU worker service (`HF_SPACE_URL`); not runnable in this sandbox. |

After the `pywt` install, the Python suite is: **~406 passed, 5 real failures** (2× LSA, 1× physical-layers schema, 1× p4, 1× gfe sparkles), 6 environment-blocked (GPU worker), 1 skipped.

---

## 4. Tooling defects found and fixed during baseline (Module 0 scope)

### TOOL-1 — `.cf-stage/` (generated export) polluted the canonical test/lint runs
- **Evidence:** `vitest.config.ts` only excluded `node_modules/**`; `eslint.config.mjs` only ignored `.next/node_modules/out`. `.cf-stage` contains a full stale copy of `lib/` including its own `__tests__`.
- **Impact:** every `npm test`/`npm run lint` ran (and failed) against a drifted duplicate tree: 2 phantom test failures, 271 phantom ESLint parser errors (`parserOptions.project` mismatch), masking real findings.
- **Fix:** added `.cf-stage/**` to `vitest.config.ts` exclude and `eslint.config.mjs` ignores. The export is documented in §1; it is NOT edited (per audit rules for staged copies).
- **Files:** `frontend/vitest.config.ts`, `frontend/eslint.config.mjs`.

### TOOL-2 — ESLint could not parse test files / unknown `react-hooks` rule
- **Evidence:** `tsconfig.json` excludes `**/*.test.ts` and `e2e`, but ESLint used `parserOptions.project: './tsconfig.json'` for all `.ts` files → 7 parser errors on test files. Two source files carry `eslint-disable react-hooks/exhaustive-deps` comments, but the plugin was never registered → 2 "rule not found" errors.
- **Fix:** flat-config block for test/e2e files parsing without a project (no type-aware rules are used), plus registering `eslint-plugin-react-hooks` (already present in node_modules as a transitive dep) with `exhaustive-deps: warn`.
- **Result:** `npm run lint` → **0 errors**, 126 warnings (pre-existing, mostly `no-unused-vars`; `--max-warnings 999` passes).
- **Files:** `frontend/eslint.config.mjs`.

---

## 5. ENGINE-CAL-1 — first verified product defect (found by baseline, fixed in Module 0 to unblock the suite)

- **Severity:** P1 (Web Scanner text verdicts wrong for short AI-boilerplate pages).
- **Evidence:** `analyzeText()` on the committed fixture "In conclusion, it is important to note that this comprehensive guide delves into…" → `aiScore 0.42, verdict UNCERTAIN`. Signal breakdown: `linguisticBrain 0.38` (penalized −0.12 for HIGH lexical diversity/hapax — wrong direction for diverse-vocab AI marketing copy), `perplexityBurst 0.5` (neutral by design, needs ≥3 sentences), `informationDensity 0.5` (neutral, needs ≥3 paragraphs), artifacts detected: 1 high + 5 medium.
- **Root cause:** the ensemble's non-artifact members are structurally neutral on short texts, and the artifact member is capped (`min(0.5, high*0.15 + med*0.05)` → 0.4, weight 0.20 → contributes 0.08). A text that is nothing but AI signature phrases mathematically cannot reach the 0.65 AI threshold.
- **Fix (minimal, evidence-gated):** artifact-density escalation in `engines.ts` — when `highArtifacts ≥ 1` AND artifact density ≥ 6 per 100 words, floor `aiScore` at 0.72 and add an explicit finding. Human text quoting occasional clichés never reaches 6/100 words (verified: human fixture = 0 artifacts, score unchanged at 0.304).
- **Verification:** `npx vitest run` → **6 files / 62 tests pass** (was 2 failing). Both engines tests green; ssrf-guard, crawler, pdf-route, scan-cache, text-detection-brain suites unaffected.
- **Files:** `frontend/lib/scanner/engines.ts`.

---

## 6. Performance baseline (production build, route JS raw sizes)

Shared framework chunks (from `/layout`): 678 KB raw / 11 chunks (≈103 KB gzipped First Load JS shared).

| Route | route+shared (raw) | route-unique (raw) |
|---|---|---|
| /detect/audio | 762 KB | 200 KB |
| /detect/video | 763 KB | 201 KB |
| /detect/text | 706 KB | 145 KB |
| /batch | 737 KB | 176 KB |
| /detect/image | 743 KB | 181 KB |
| /detect/document | 584 KB | 173 KB |
| /settings | 692 KB | 106 KB |
| /profile | 693 KB | 107 KB |
| /history | 661 KB | 108 KB |
| /verify/web | 649 KB | 96 KB |
| /dashboard | 543 KB | 50 KB |
| /scraper | 546 KB | 61 KB |
| /chat | 548 KB | 55 KB |
| /credits | 562 KB | 44 KB |
| /workflows | 534 KB | 41 KB |
| /pipeline | 531 KB | 46 KB |

Note: prior audit round (commit `520e837`) already moved recharts off `/history` and supabase-js off 4 routes. The remaining heavy routes are the five `/detect/*` + `/batch` pages (Module 2 targets). Server-side runtime profiling (middleware Supabase round-trip per request — see `middleware.ts` `checkMaintenanceMode`) is a Module 2 target: it runs a DB query on every non-exempt request with no cache.

---

## 7. Coverage gaps recorded (not fixed here)

| ID | Gap |
|---|---|
| G-1 | `frontend/tsconfig.json` excludes tests from `type-check`; no `vitest typecheck` configured. |
| G-2 | `admin/` has no ESLint config — `next lint` is interactive/blocked. |
| G-3 | `admin/` has no type-check script. |
| G-4 | `cf-pipeline/` has no tests and no CI test step (CI parity to be reviewed in Module 9). |
| G-5 | No E2E runner config found for `frontend/e2e/critical-paths.spec.ts` (Playwright not in devDeps — to verify in Module 9). |
| G-6 | `signal-worker` GPU-path tests require a live GPU service; blocked in this sandbox (documented, not fixable locally). |

---

## 8. Environment limitations (truthful disclosure)

- No Supabase/Redis/Upstash/Clerk/R2 credentials in this sandbox: live integrations are tested via existing unit tests and code-path tracing only. No production data was touched.
- No GPU worker service: `test_gpu_worker.py` blocked (6 tests).
- `pip install -r requirements.txt` for signal-worker exceeds sandbox disk (torch); tests run with system numpy + PyWavelets.
- No browser-based profiling was possible before the build; performance work in Module 2 uses build-output measurement + code-path analysis (documented per-audit rules).

## Module 0 exit criteria — status

- [x] Correct repository and branch verified (`anasali89ji/AI-SCERN`, `fix/comprehensive-audit-2026`).
- [x] Existing work preserved (clean clone; tag `checkpoint-pre-audit-2026`).
- [x] Active app/service boundaries identified (§1).
- [x] Baseline results recorded before fixes (§2–§6).
- [x] Safe local test strategy established (unit suites green or itemized; no live-service tests counted as passing).
