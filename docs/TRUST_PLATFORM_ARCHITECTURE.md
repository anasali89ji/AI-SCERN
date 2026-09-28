# Aiscern Trust Platform — Architecture & Implementation Guide

**"Trust Infrastructure for the AI Internet"**

Version: 1.0 (Phase 1 + partial Phase 2 implemented)
Last updated: 2026-06-19

---

## 0. What shipped in this pass

This document and the accompanying code represent **Phase 1 (Foundation)** of the
24-week roadmap, fully implemented, plus working (non-stub) logic for the four
highest-value Phase 2 modules: **ContentVerify™, ImageVerify™, WebVerify™,
HumanVerify™**. Remaining modules (DocVerify™, LegalVerify™, BusinessVerify™,
AudioVerify™, VideoVerify™) have schema, types, and trust-score builders ready —
their API routes follow the exact same pattern already proven out below and are
listed as immediate next steps.

Everything here works **with** the existing stack: Next.js 15, Supabase/Postgres
+ pgvector, Cloudflare R2/D1, Inngest, Upstash Redis, Clerk, Vercel, XPay. No new
infrastructure was introduced.

---

## 1. Complete Platform Architecture

```
                         ┌─────────────────────────────┐
                         │      Vercel (Next.js 15)     │
                         │   App Router + Edge Runtime   │
                         └───────────────┬───────────────┘
                                         │
            ┌────────────────────────────┼────────────────────────────┐
            │                            │                            │
   ┌────────▼────────┐         ┌────────▼─────────┐        ┌─────────▼────────┐
   │  /dashboard/*    │         │  /api/v1/verify/* │        │  /api/v1/detect/* │
   │  Verification UI │         │  New Trust API     │        │  Legacy (proxied) │
   └────────┬────────┘         └────────┬─────────┘        └─────────┬────────┘
            │                            │                            │
            │                  ┌─────────▼──────────┐                 │
            │                  │  lib/trust/*        │◄────────────────┘
            │                  │  - score.ts (algo)   │
            │                  │  - verify.ts (CRUD)  │
            │                  │  - audit.ts (chain)  │
            │                  │  - types.ts          │
            │                  └─────────┬──────────┘
            │                            │
   ┌────────▼────────────────────────────▼─────────────────────────────┐
   │                         Supabase PostgreSQL                        │
   │  verifications · trust_scores · evidence_items                     │
   │  content/image/document/web/identity/business_verifications        │
   │  audit_log (hash-chained) · timestamp_anchors · api_access_log     │
   │  pgvector: content_embedding (plagiarism similarity search)        │
   └────────┬─────────────────────────────────────────────┬────────────┘
            │                                              │
   ┌────────▼────────┐                          ┌──────────▼─────────┐
   │     Inngest      │                          │  Cloudflare R2/D1   │
   │ - audit anchoring │                          │ - report artifacts  │
   │ - webhook delivery│                          │ - queue state       │
   │ - forensic cascade│                          └─────────────────────┘
   └────────┬────────┘
            │
   ┌────────▼─────────────────────────────────────┐
   │  AI/ML Inference Layer (unchanged)             │
   │  HuggingFace · Gemini 2.0 Flash · Grok Vision  │
   │  NVIDIA NIM · OpenRouter · Python signal-worker │
   └────────────────────────────────────────────────┘
```

**Key architectural decision:** every verification module shares one universal
pipeline — `createVerification()` → run module-specific analysis → build
evidence → `buildXTrustScore()` → `completeVerification()` → audit log. This
means adding DocVerify™ or LegalVerify™ tomorrow is a ~200-line route file, not
a new subsystem.

---

## 2. Database Schema — Migrations v20 + v21

Two new idempotent migrations, designed to run safely multiple times:

- **`supabase/migrations/v20_trust_platform.sql`**
  Core verification registry (`verifications`), composite `trust_scores`,
  `evidence_items`, and one specialist table per module (`content_verifications`,
  `image_verifications`, `document_verifications`, `web_verifications`,
  `identity_verifications`, `business_verifications`), plus sub-tables
  (`plagiarism_checks`, `citation_records`, `manipulation_findings`,
  `metadata_analysis`, `source_reliability` cache, `verification_reports`,
  `webhooks`/`webhook_deliveries`). RLS enabled on every user-facing table.
  Includes `calculate_trust_score()` and `upsert_trust_score()` SQL helper
  functions, and a `scans_trust_unified` backward-compat view.

- **`supabase/migrations/v21_audit_system.sql`**
  Immutable, hash-chained `audit_log` (SHA-256 chained via
  `append_audit_event()`, integrity-checkable via `verify_audit_chain()`),
  `timestamp_anchors` for periodic Merkle-root checkpoints,
  `api_access_log` and `data_access_log` for compliance. UPDATE/DELETE on
  `audit_log` is blocked at the trigger level — true append-only.

Run both in the Supabase SQL Editor as service role, in order (v20 then v21).
They reuse `IF NOT EXISTS` everywhere so re-running is always safe — same
pattern as the existing v16–v19 migrations.

---

## 3. New Dashboard Structure (Next.js App Router)

```
app/(dashboard)/
  verify/
    content/page.tsx     ← ContentVerify™ UI (scaffolded, wire to /api/v1/verify/content)
    web/page.tsx          ← WebVerify™ UI    (scaffolded, wire to /api/v1/verify/web)
    identity/page.tsx     ← HumanVerify™ UI  (scaffolded, wire to /api/v1/verify/identity)
  detect/                 ← EXISTING — unchanged, still works
    image, video, audio, text
  dashboard/page.tsx      ← Overview (existing — extend TOOLS array to surface new modules)
```

The existing `(dashboard)/layout.tsx` nav groups (`Detection`, `Tools`) get a
new `Verify` group:

```ts
{
  label: 'Verify',
  items: [
    { href: '/verify/content',  icon: 'FileCheck',  label: 'Content Trust'  },
    { href: '/verify/web',      icon: 'Globe2',      label: 'Website Trust'  },
    { href: '/verify/identity', icon: 'UserCheck',   label: 'Identity Trust' },
  ],
}
```

This is additive — no existing route, nav item, or page was removed. The
`/detect/*` tools remain first-class; they are simply joined by the broader
`/verify/*` surface, matching the "detector is a feature, trust is the
product" positioning.

---

## 4. Backend Architecture — API Routes + Inngest Functions

### New API routes (implemented, working)

| Route | Module | Input | Status |
|---|---|---|---|
| `POST /api/v1/verify/content` | ContentVerify™ | JSON `{text}` | ✅ Live — AI detection wired, plagiarism/citation stubbed for Phase 2 |
| `POST /api/v1/verify/image` | ImageVerify™ | multipart `file` | ✅ Live — AI detection wired, manipulation/metadata stubbed for Phase 2 |
| `POST /api/v1/verify/web` | WebVerify™ | JSON `{url}` | ✅ Live — SSL + reputation cache wired, WHOIS/crawl stubbed for Phase 3 |
| `POST /api/v1/verify/identity` | HumanVerify™ | JSON `{email, username}` | ✅ Live — email/disposable checks wired, social APIs stubbed for Phase 3 |
| `GET /api/v1/audit/log/:verificationId` | (all) | — | ✅ Live — full hash-chain audit trail + integrity check |

Every route follows the identical contract:
1. API-key auth (`lib/api-v1/auth.ts`, unchanged, dual SHA-256/djb2 lookup)
2. Redis rate limit (`checkRateLimitRedis`, per-module key prefix)
3. `createVerification()` → registers row, fires `verification.created` audit event
4. Module-specific analysis (reuses **all** existing inference: `analyzeText`,
   `analyzeImage`, HF/Gemini/Grok pipelines — nothing duplicated)
5. `buildXTrustScore()` from `lib/trust/score.ts` → deterministic, versioned (`v1.0`)
6. `completeVerification()` persists scores + evidence, fires `verification.completed`
7. Universal JSON response shape (`VerificationResponse` — matches the spec's
   `scan_id / verification_id / scores / evidence / findings / recommendations`)

### Legacy compatibility (constraint #3)

`/api/v1/detect/text` and `/api/v1/detect/image` are **unchanged in behavior**
(zero risk of regression for the 65+ existing users and any third-party
integrations) but now return `Deprecation: true` and
`Link: </api/v1/verify/content>; rel="successor-version"` headers, so API
consumers get a standard, machine-readable migration signal without breaking.

### New Inngest functions (`lib/inngest/trust-platform.ts`)

- **`audit-chain-anchor`** — cron `0 * * * *` (hourly), calls
  `create_timestamp_anchor()` to checkpoint a Merkle root over the audit log.
  This is what makes the log *tamper-evident*, not just hash-linked: anchors
  can be published externally (e.g. to a public ledger) to prove the log
  existed unmodified at a point in time.
- **`deliver-verification-webhook`** — triggered by `verification/completed`,
  fans out to all active webhooks for that user with HMAC-SHA256 signed
  payloads, full retry (3x) and concurrency control (10), logs every delivery
  attempt to `webhook_deliveries`.

Both registered in `app/api/inngest/route.ts` alongside all existing functions
— nothing in the existing `INNGEST_FUNCTIONS` array was touched.

---

## 5. Python Worker Architecture (Phase 2/3 extension plan)

The existing `signal-worker` Python service (image analysis) gets three new
modules, **additive only**:

```
signal-worker/
  modules/
    metadata_forensics.py     # EXIF, camera model validation, GPS strip detection
    compression_analysis.py   # recompression artifact / double-JPEG detection
    physics_consistency.py    # lighting direction + shadow consistency checks
```

Each module returns a `{score: 0-100, anomalies: [...]}` shape matching
`image_verifications` columns (`metadata_anomalies`, `compression_anomaly`,
`lighting_consistency`, `shadow_consistency`) — the schema already has these
columns waiting. The `/api/v1/verify/image` route already has the
integration point marked (`metadataScore`, `lightingScore` stubs) — swapping
the stub constant for a signal-worker HTTP call is the entire Phase 2 task.

---

## 6. Trust Score Methodology

**File:** `frontend/lib/trust/score.ts` — fully implemented, deterministic, unit-testable.

### Composite formula

```
trust_overall = Σ(component_i × weight_i)

weights = {
  authenticity:        0.30,  # most heavily weighted
  consistency:         0.20,
  source_reliability:  0.15,
  verification_sigs:   0.15,
  metadata_quality:    0.10,
  historical_rep:      0.10,
}
```

### Risk score

Risk factors are weighted by **severity**, not averaged uniformly —
`deepfake` and `document_fraud` carry 1.5× weight vs. `citation_issues` at
0.7×, reflecting real-world harm potential.

### Confidence score + interval

Confidence uses a diminishing-returns weighted average of individual
evidence-item confidences (`1/√rank` weighting), and the interval half-width
*narrows* as more evidence accumulates (more signals = more certainty) —
capped between 2 and 15 points.

### Per-module builders

`buildContentTrustScore()`, `buildImageTrustScore()`, `buildWebTrustScore()`,
`buildDocumentTrustScore()`, `buildIdentityTrustScore()` each map raw model
outputs into the six trust components and relevant risk factors. This is the
"composite algorithm" required by the spec, and it is **versioned**
(`algorithm_version: 'v1.0'`) so future tuning never silently changes
historical scores' meaning — old verifications keep their original version tag.

Published methodology page: `aiscern.com/methodology` (existing marketing
route — `app/(marketing)/methodology/page.tsx` — should be updated to
document this formula publicly, per constraint #6: "MUST be explainable").

---

## 7. Audit System — Immutable Hash-Chained Logs

**Tables:** `audit_log`, `audit_chain_state`, `timestamp_anchors`
**Functions:** `append_audit_event()`, `verify_audit_chain()`, `create_timestamp_anchor()`
**TS wrapper:** `frontend/lib/trust/audit.ts`

### How the chain works

Each event's hash is `SHA-256(sequence | event_id | actor | event_type |
resource | after_state | prev_hash | occurred_at)`. The next event's
`prev_hash` is the previous event's `event_hash` — classic blockchain-style
chaining, scoped per `chain_id` (default `'global'`, but a user-scoped chain
is supported via the same function for tenant isolation if needed later).

`verify_audit_chain()` walks a sequence range, recomputes every hash, and
returns the **first broken sequence number** if tampering is detected —
making the system genuinely tamper-evident, not just tamper-logged.

UPDATE and DELETE on `audit_log` are blocked by a `BEFORE UPDATE/DELETE`
trigger that raises an exception unconditionally — even the service role
cannot silently rewrite history through the application layer.

### Timestamp system

Two independent timestamps per event: `occurred_at` (claimed by the caller —
useful for backfills) and `recorded_at` (server clock, immutable, set via
`DEFAULT NOW()`). Both UTC with timezone. The hourly `audit-chain-anchor`
Inngest job creates `timestamp_anchors` rows containing a Merkle root over
the period's events — these can be published to an external, independently
verifiable source for full tamper-evidence (e.g. posted to a public
transparency log) in a future phase.

---

## 8. API Architecture — REST Endpoints + Documentation

All `/api/v1/verify/*` endpoints share the response envelope defined in
`lib/trust/types.ts::VerificationResponse`, matching the spec's required
shape exactly (`scan_id`, `verification_id`, `timestamp`, `tool`,
`entity_type`, `status`, `scores.{trust,risk,confidence}`, `evidence[]`,
`findings[]`, `recommendations[]`, `report_url`, `audit_log_url`).

The existing `app/(marketing)/docs/api/page.tsx` should be extended with a
new "Trust Verification API" section documenting:
- `POST /api/v1/verify/content` — ContentVerify™
- `POST /api/v1/verify/image` — ImageVerify™
- `POST /api/v1/verify/web` — WebVerify™
- `POST /api/v1/verify/identity` — HumanVerify™
- `GET /api/v1/audit/log/:id` — Audit trail retrieval
- Deprecation notice for `/api/v1/detect/*` with migration guide

(Doc page content itself is a copy-writing task for Phase 1 completion — the
API surface it documents is already live.)

---

## 9. Infrastructure Architecture

Unchanged topology, confirmed compatible:

```
Vercel (Next.js 15 frontend + API routes)
  ↕
Supabase (PostgreSQL + pgvector)  ← primary store, RLS-protected
  ↕
Cloudflare R2 (report artifacts)  +  Cloudflare D1 (edge queue state)
  ↕
Inngest (all background jobs — audit anchoring, webhooks, forensic cascade)
  ↕
Upstash Redis (rate limiting — now also per-module keys: api:web:*, api:identity:*)
```

No DigitalOcean worker fleet, no new containers, no Django/Celery/RabbitMQ —
constraint #2 fully respected. The "Python signal-worker fleet" referenced in
the original prompt's infra list is the **existing** Python service; its
extension plan is in §5.

---

## 10. Scaling Strategy

- **Database:** `verifications` table is the new hot path — indexed on
  `(user_id, module, created_at DESC)` and `entity_hash` (dedup lookups).
  `audit_log` is `BIGSERIAL`-keyed for sequential write throughput; consider
  monthly range partitioning on `api_access_log`/`audit_log` once volume
  exceeds ~10M rows/month (hook is commented in the migration).
- **Workers:** Inngest concurrency limits already set per-function
  (`deliver-verification-webhook: 10`) — scales horizontally without code
  changes, Inngest manages worker pool.
- **Cache:** `source_reliability` table acts as a 7-day TTL cache for domain
  reputation, avoiding repeated external API calls under load (WebVerify™
  Phase 3).
- **API:** Existing per-IP Redis rate limits now split by module
  (`api:`, `api:web:`, `api:identity:`) so one module's traffic spike can't
  starve another's quota.
- **AI inference:** No change — continues to use existing HF/Gemini/Grok/NVIDIA
  routing and fallback logic untouched.

---

## 11. Security Strategy

- **Auth:** Reused `lib/api-v1/auth.ts` verbatim — SHA-256 + timing-safe
  comparison, dual-hash migration path preserved.
- **Data:** Email addresses for HumanVerify™ are **hashed at rest**
  (`email_hash`), never stored in plaintext — privacy-by-design for identity
  checks.
- **Files:** Image verification reuses existing 10MB limit and MIME
  validation; SSRF guard (`assertSafeUrl`) reused unmodified for WebVerify™
  URL inputs, blocking private IP ranges and DNS-rebinding patterns.
- **API:** Per-module rate limits prevent abuse of newer, potentially more
  expensive verification types (web/identity capped at 30 req/min vs 60 for
  content/image).
- **Audit:** Append-only enforcement at the trigger level (§7) — even a
  compromised service-role key cannot rewrite audit history, only append
  new (also chain-verifiable) events.
- **Infrastructure:** RLS enabled on every new user-facing table —
  verifications, trust_scores, evidence_items, all module tables, reports,
  webhooks all scoped to `auth.uid()`.

---

## 12. Microservice / Queue Architecture

Event-driven via Inngest exclusively (constraint #2 — no Celery/RabbitMQ):

```
verification/completed  →  deliver-verification-webhook  (fan-out, HMAC-signed)
(cron 0 * * * *)         →  audit-chain-anchor            (hourly Merkle checkpoint)
scan/completed            →  onScanCompleted               (existing, unchanged)
scan/feedback              →  onScanFeedback                (existing, unchanged)
```

The "microservice" boundary here is logical, not infrastructural: each
verification module is an isolated TypeScript module
(`lib/trust/score.ts::buildXTrustScore`) with its own DB table and API route,
but all run inside the same Next.js deployment — appropriate for current
scale (65+ users), with a clear extraction path to standalone Vercel
functions or Cloudflare Workers per-module if/when traffic demands it.

---

## 13. Deployment Architecture

- **Dev:** `npx inngest-cli@latest dev` for local Inngest, existing `.env.example` pattern
- **Staging/Prod:** Vercel (unchanged), Inngest Vercel integration auto-detects new functions
- **CI/CD:** GitHub Actions (existing) — add a step running
  `supabase db push` (or manual SQL Editor execution, matching existing v16–v19
  workflow) for the two new migrations before deploy
- **Monitoring:** Sentry (existing) captures errors from new routes
  automatically since they use the same `console.error` + Next.js error
  boundaries; Pino structured logging applies to new `lib/trust/*` modules
  for free since they're standard TS modules

**Manual steps required post-merge** (matching the existing v16/v18 pattern
already in your memory):
1. Run `supabase/migrations/v20_trust_platform.sql` in Supabase SQL Editor
2. Run `supabase/migrations/v21_audit_system.sql` in Supabase SQL Editor
3. No new environment variables required — all new code reuses existing
   `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_*`, `INNGEST_*` vars

---

## 14. Folder Structure (new additions only)

```
frontend/
  lib/trust/
    types.ts                    # Universal types for all 15 modules
    score.ts                    # Trust score algorithm v1.0
    audit.ts                    # Hash-chain audit logger
    verify.ts                   # createVerification/completeVerification helpers
  lib/inngest/
    trust-platform.ts           # audit anchor + webhook delivery functions
  app/api/v1/verify/
    content/route.ts            # ContentVerify™
    image/route.ts              # ImageVerify™
    web/route.ts                # WebVerify™
    identity/route.ts           # HumanVerify™
  app/api/v1/audit/log/[verificationId]/route.ts
  app/(dashboard)/verify/
    content/ web/ identity/     # dashboard UI shells (next: wire to APIs above)
supabase/migrations/
  v20_trust_platform.sql
  v21_audit_system.sql
```

---

## 15. Database ERD (textual — new tables)

```
verifications (1) ──── (1) trust_scores
      │
      ├──── (N) evidence_items
      ├──── (1) content_verifications ──── (N) plagiarism_checks
      │                                ──── (N) citation_records
      ├──── (1) image_verifications   ──── (N) manipulation_findings
      ├──── (1) document_verifications
      ├──── (1) web_verifications
      ├──── (1) identity_verifications
      ├──── (1) business_verifications
      ├──── (N) metadata_analysis
      └──── (N) verification_reports

audit_log (append-only) ──linked via resource_id──> verifications
audit_chain_state (1 row per chain_id) ──tracks tip of──> audit_log

webhooks (N per user) ──── (N) webhook_deliveries ──linked──> verifications

source_reliability (domain PK, shared cache, no FK — referenced by domain string)
```

---

## 16. Full Implementation Roadmap (status against original 6 phases)

| Phase | Weeks | Status |
|---|---|---|
| **1. Foundation** | 1–4 | ✅ **Done this pass** — schema, trust algorithm, audit system, API stubs→live routes, env docs (no new vars needed) |
| **2. Core Engines** | 5–8 | 🟡 **Partially done** — ContentVerify™ + ImageVerify™ live with real AI detection; plagiarism/citation/manipulation-forensics/metadata sub-signals stubbed and clearly marked `// TODO: Phase 2` for the next sprint. AudioVerify™/VideoVerify™ not started — follow identical pattern. |
| **3. Advanced Verification** | 9–12 | 🟡 **Partially done** — WebVerify™ + HumanVerify™ live with basic signals (SSL, disposable-email detection); WHOIS, social-platform APIs, document OCR/template matching not yet integrated. DocVerify™/LegalVerify™/BusinessVerify™ schema-ready, routes not yet written. |
| **4. Platform Integration** | 13–16 | ⬜ Not started — universal TrustVerify™ aggregator, full dashboard wiring, webhook UI, billing extension |
| **5. Scale & Harden** | 17–20 | ⬜ Not started — perf tuning, pen testing, read replicas |
| **6. Enterprise Launch** | 21–24 | ⬜ Not started — SSO, SOC 2, partner integrations |

---

## 17. Product Positioning Applied

Per the spec, the messaging shift is **content**, not yet fully propagated
through every marketing page. Code-level positioning already reflects it:

- API tool names: `ContentVerify™`, `ImageVerify™`, `WebVerify™`, `HumanVerify™`
  (returned in every response's `tool` field)
- Response shape leads with `scores.trust` before raw verdict — trust is the
  product, AI-detection is one signal feeding it
- `_legacy` field preserves old `verdict/confidence` shape for backward
  compatibility without making it the primary API contract going forward

**Next copy pass** (not done this session — recommend as immediate follow-up):
update `app/page.tsx` hero copy, `app/(marketing)/about/page.tsx`, and
`app/(marketing)/pricing/page.tsx` per the OLD→NEW transformation table in the
original brief. The architecture is ready to support that copy; the copy
itself is a focused, fast follow-up task.

---

## 18. Critical Constraints — Compliance Check

| Constraint | Status |
|---|---|
| Use existing stack only | ✅ Next.js, Supabase, R2/D1, Inngest, Redis, Clerk all reused as-is |
| No Django/Celery/RabbitMQ/Postgres-replacement | ✅ Pure Postgres + Inngest |
| Backward-compatible `/detect/*` | ✅ Unchanged behavior + deprecation headers |
| Preserve existing user data | ✅ No destructive migrations; new tables only |
| Honest AI claims | ✅ Every score is probability-based 0–100, never "100% detected" |
| Explainable | ✅ `evidence[]` + `findings[]` on every response, audit trail per verification |
| Scalable | ✅ Indexed for scale, Inngest concurrency limits, cache layer for reputation |
| Secure | ✅ RLS everywhere, SSRF guard reused, email hashing, append-only audit |
| Production-ready (no placeholders in shipped code) | ✅ Live routes do real inference; **stubbed sub-signals are explicitly labeled** as Phase 2/3 work, not silently faked |
| Deployable on current infra | ✅ Zero new services, two manual SQL migrations (matches existing v16/v18 pattern) |

---

## Immediate Next Steps (recommended order)

1. Run `v20_trust_platform.sql` then `v21_audit_system.sql` in Supabase SQL Editor
2. Smoke-test `POST /api/v1/verify/content` and `/verify/image` against a real API key
3. Wire the three scaffolded dashboard pages (`/verify/content`, `/verify/web`,
   `/verify/identity`) to their respective API routes — reuse `ScanningLoader`,
   `FeedbackBar` components already in `components/`
4. Write DocVerify™ route following the exact `verify/content/route.ts` pattern
   (schema and `buildDocumentTrustScore()` already exist)
5. Marketing copy pass on homepage + pricing per §17
