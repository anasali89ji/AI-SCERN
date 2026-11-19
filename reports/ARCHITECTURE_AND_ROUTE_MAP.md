# ARCHITECTURE AND ROUTE MAP (Module 1)

**Branch:** `fix/comprehensive-audit-2026` · **Base:** `main@520e837` · Compiled from actual imports/configs, not docs.

## 1. Source-of-truth map — what is actually built, deployed, invoked

| Component | Role | Evidence |
|---|---|---|
| `frontend/` (Next.js 15, `aiscern`) | **Canonical customer app**: marketing + legal + auth + dashboard + all `/api/*` customer routes. Deployed on Vercel (`.vercel/project.json`, `vercel.json` with per-route `maxDuration` overrides). | Build verified; nav in `app/(dashboard)/layout.tsx` |
| `admin/` (Next.js 14, `aiscern-admin`) | **Separate admin app** (own domain `admin.aiscern.com` per CORS list). 24 dashboard tabs, 46 API routes, own middleware + `admin_users`/`admin_sessions` auth (bcrypt + Upstash rate limit). | Build verified |
| `cf-pipeline/` | Cloudflare data pipeline workers (18 wrangler configs: `a`–`p` shards + ratelimit). Extractors for HF datasets, D1 migrations. | `tsc` verified |
| `cf-workers/` | Load-balancer + proxy worker (deprecated? `wrangler-lb.toml`) | Module 6 |
| `cloudflare-worker/` + root `cloudflare-worker.ts` | Additional worker variants (legacy/duplicate candidates) | Module 6 |
| `signal-worker/` | Python forensic analysis service (CPU `app.py` + GPU variants), 38 test files, 450 tests. Called by frontend via HF Space / DigitalOcean URLs. | 404/450 pass locally |
| `supabase/` | 50 SQL migrations → 79 tables (list in §6). Auth/storage via Supabase; Clerk for identity. | migrations parsed |
| `.github/workflows/` | CI (`ci.yml`), deploys (vercel/admin/cf), calibrations, pipeline automation. | Module 9 parity check |
| `frontend/.cf-stage/` | **Generated marketing-only deployment export** (`aiscern-marketing`, only `(legal)`+`(marketing)` routes). Tracked but non-canonical; excluded from test/lint in Module 0. | package.json name; route subset |

## 2. Customer dashboard routes → backend execution paths

| Route (page) | Entry components | API called | Persisted table(s) | Notes |
|---|---|---|---|---|
| `/dashboard` | `(dashboard)/dashboard/page.tsx` | `/api/user/stats`, `/api/user/scans` | `scans` (read) | |
| `/detect/text` | detect pages under `(dashboard)/detect/text` | `/api/detect/text` | `scans`, `scan_feedback` | text ensemble + optional RAG |
| `/detect/image` | `(dashboard)/detect/image` | `/api/upload` (R2 presign) → `/api/detect/image` → `/api/detect/image/finalize` | `scans`, `image_verifications`, `detection_embeddings` | CV worker + HF GPU worker |
| `/detect/audio` | `(dashboard)/detect/audio` | `/api/detect/audio` | `scans` | forensic pipeline |
| `/detect/video` | `(dashboard)/detect/video` | `/api/detect/video` | `scans` | NVIDIA NIM path |
| `/detect/document` | `(dashboard)/detect/document` | `/api/detect/document`, `/api/detect/pdf` | `scans` | composite verdict |
| `/batch` | `(dashboard)/batch` | `/api/detect/batch` | `batch_jobs`, `scans` | mixed items |
| `/scraper` (Web Scanner) | `(dashboard)/scraper/page.tsx` | `/api/scanner` | `scans` (text row), `site_scan_seals`, `user_site_scan_counts` | **canonical**; `/scanner` page redirects here |
| `/verify/web` | `(dashboard)/verify/web/page.tsx` | `/api/verify/web`, `/api/v1/verify/web` | `web_verifications`, `evidence_items`, `audit_log` | evidence chain + seals |
| `/chat` (ARIA) | `(dashboard)/chat` | `/api/chat` (streaming), `/api/chat/history` | `chat_sessions`, `chat_messages` | |
| `/workflows`, `/workflows/new` | `(dashboard)/workflows` | `/api/workflows`, `/api/workflows/[id]/execute` | `workflows`, `workflow_runs`, `workflow_templates` | Inngest `executeWorkflow` |
| `/pipeline` | `(dashboard)/pipeline` | `/api/pipeline-stats` | `pipeline_state` | |
| `/history` | `(dashboard)/history` | `/api/user/scans`, `/api/scan/*` | `scans` | |
| `/credits` | `(dashboard)/credits` | `/api/user/credits`, `/api/credits/purchase`, `/api/billing/*` | `credit_transactions`, `subscriptions`, `payment_events` | |
| `/profile` | `(dashboard)/profile` | `/api/profiles/*` | `profiles` (via Clerk id) | |
| `/settings` | `(dashboard)/settings` | `/api/user/settings`, `/api/user/api-keys` | `user_settings`, `api_keys` | |
| `/forensic/*`, `/scan/*`, `/preview/*`, `/verify/[seal]`, `/maintenance`, `/unauthorized` | misc | various | | public verify + operational pages |

Navigation (verified in `app/(dashboard)/layout.tsx`): Overview, Text, Image, Audio, Video, Document, AI Assistant(`/chat`), Batch, **Web Scanner(`/scraper`)**, Web Verify, Workflows, History, Credits, Profile, Settings. `Pipeline` was removed from nav (commit `6a54c93`) but `/pipeline` page still exists.

## 3. API families (frontend app)

**Detection:** `/api/detect/{text,image,image/finalize,audio,video,document,pdf,batch,site,web,feedback}` — site=full-site scan (legacy `lib/site-crawler/site-scanner.ts`), web=single-page (Jina + brain).

**Scanner:** `/api/scanner` (canonical, `lib/scanner/*`) · `/api/scraper` (**legacy duplicate**, 440-line Gemini implementation, zero frontend callers, only a `vercel.json` maxDuration entry).

**v1 public API:** `/api/v1/detect/{text,image,audio}`, `/api/v1/verify/{web,content,document,image,identity}`, `/api/v1/audit/log/[verificationId]` (API-key auth, separate rate limits).

**v2:** `/api/v2/forensic-scan[/scanId]`.

**Verify/seals:** `/api/verify/{web,seal,seal/[sealNumber],[hash],site/[hash]}` — public seal + hash verification.

**Platform:** `/api/upload`, `/api/inngest` (Inngest serve: `onScanCompleted`, `onScanFeedback`, `processFeedbackJob`, `scheduledPipelineCheck`, `executeWorkflow`, `auditChainAnchor`, `deliverVerificationWebhook`), `/api/pipeline{,-stats,/push}`, `/api/user/*` (stats, scans, credits, settings, api-keys, delete-account, upgrade-request), `/api/profiles/*`, `/api/credits/purchase`, `/api/billing/*`, `/api/chat/*`, `/api/analytics/*`, `/api/reports`, `/api/reviews/*`, `/api/webhook(s)`, `/api/health`, `/api/warmup`, `/api/maintenance`, `/api/og`, `/api/image-proxy`, `/api/contact`, `/api/subscribe`, `/api/benchmarks`, `/api/dataset-stats`.

**Admin (frontend-hosted):** `/api/admin/*` (15 routes) — gated by `middleware.ts` `isAdminRoute` (Clerk role `ADMIN/OWNER/EXECUTIVE/MANAGER/ANALYST/MARKETING/SUPPORT` or `ALLOWED_ADMIN_IDS`).

## 4. Admin app surface (`admin/`)

24 tabs (verified files): Overview, Analytics, Users, Admin Users, Scans, API Keys, Revenue, Rate Limits, Pipeline, Pipeline Cost Summary, Health, Errors, Audit Log, Settings, Branding, Feature Flags, Announcements, Notifications, Support, Content Moderation, Webhooks, Backup, Maintenance, Marketing. 46 API routes under `admin/app/api/*` (auth/hf-push/webhooks/support-tickets/backup/realtime/blocked-domains/stats/pipeline-cost-summary/security/feature-flags/content-moderation/api-keys/pipeline/marketing/...). Auth chain: `admin/middleware.ts` (29 lines) + `lib/admin-middleware.ts` (76 lines) + bcrypt `admin_users`/`admin_sessions`. Detailed audit in Module 7.

## 5. Cross-cutting lib map (frontend/lib)

| Dir | Role | Live callers |
|---|---|---|
| `scanner/` | **canonical Web Scanner stack** (crawler, engines, duplicity, image-forensics, trust, stylometry, wordpress, perplexity) | `/api/scanner` |
| `site-crawler/` | legacy site-scan family; **only `integrity-seal.ts` (2 importers) and `site-scanner.ts` (`/api/detect/site`) are live**; `forensics/site-trust/wordpress-deep/simhash/extract-article/ai-artifacts/stylometry` have 0 importers (dead code) |
| `inference/` | detection brains (text-detection-brain, hf-analyze, gemini-analyzer, NVIDIA) | detect routes |
| `forensic/`, `document/`, `rag/`, `trust/`, `seal/` | signal libs, doc parsing, RAG, trust scoring, seal issuance | various |
| `middleware/` | `credit-guard.ts` (auth+quota) + `site-scan-guard.ts` (Web Scanner quota) | all detect routes |
| `cache/` | redis (Upstash) + `scan-cache.ts` (content-hash result cache) | detect routes, scanner |
| `storage/` | R2/S3 helpers | upload/image/video |
| `inngest/` | 8 background functions | `/api/inngest` |
| `supabase/` | server admin client + ssr clients | everywhere |
| `security/`, `utils/ssrf-guard.ts` | SSRF guard (sync + resolved + safeFetch) | scanner/verify/web routes |

## 6. Database (from 50 migrations, in order)

79 tables incl. `scans`, `scan_feedback`, `scan_seals`, `scraper_sessions`, `user_site_scan_counts`, `user_scan_counts`, `api_keys`, `api_usage_logs`, `credit_transactions`, `subscriptions`, `payment_events`, `admin_users`/`admin_sessions`/`admin_roles`/`admin_audit_log`, `chat_sessions`/`chat_messages`, `workflows`/`workflow_runs`/`workflow_templates`, `web_verifications`/`content_verifications`/`image_verifications`/`document_verifications`/`identity_verifications`/`business_verifications`, `verifications`/`verification_reports`/`evidence_items`/`audit_chain_state`, `calibration_*`, `forensic_scans`/`forensic_layers`/`forensic_scan_events`, `pipeline_state`, `site_settings`, `feature_flags`, `rate_limits`, `webhook*`, `support_tickets`, etc. RPCs: `check_and_increment_scan`, `check_and_increment_site_scan` (v36 adds per-plan `max_pages_per_scan`/`max_images_per_scan`: free 30/40, starter 150/100, pro 500/150, enterprise 5000/500; daily 5/25/100/∞).

## 7. Key findings for later modules (from this inventory)

1. **Duplicated scanner implementations**: `/api/scanner` (canonical, `lib/scanner/`) vs `/api/scraper` (legacy Gemini) vs `/api/detect/site` (older `lib/site-crawler/site-scanner.ts`). UI uses only `/api/scanner`.
2. **Dead code**: 7 of 9 `lib/site-crawler/*` modules have zero importers.
3. **Web Scanner plan caps mismatch UI**: Deep mode advertises "150 pages/200 images" but starter plan caps images at 100; free users see Deep button ungated (silently clamped to 30 pages server-side); Pro button says "500 + 100" while actual pro cap is 150 images. → Module 3.
4. **`/api/scanner` ordering defect**: `siteScanGuard()` (quota increment) runs BEFORE cache lookup; cache hits consume quota and skip history insert; cache key (`hashText(url+mode)`) is user-agnostic → a free user can receive a cached pro-deep result and another user's seal. → Module 3.
5. **Middleware DB round-trip per request**: `checkMaintenanceMode` creates a Supabase client and queries `site_settings` on every non-exempt request (no cache) → prime suspect for slow navigation (P1). → Module 2.
6. **Remaining heavy bundles**: `/detect/audio` `/detect/video` `/detect/text` `/batch` `/detect/image` carry 145–201 KB route-unique JS. → Module 2.
7. `/pipeline` page exists but is absent from nav (intentional per commit `6a54c93`) — verify status source in Module 4.10.

## Module 1 exit criteria — status

- [x] Route/API/worker/database matrix exists (§1–§6).
- [x] Every customer dashboard tool has a known frontend entry + backend path (§2).
- [x] Every admin tab paired with its API surface + auth boundary (§4; deep test in Module 7).
- [x] Legacy/staged/duplicate/unused implementations identified (§1, §5, §7).
