# SECURITY AND DATA INTEGRITY (Module 5 + Module 8)

## Fixed this round

| ID | Sev | Area | Root cause | Fix | Verification |
|---|---|---|---|---|---|
| WH-SIG-1 | P1 | `/api/webhooks/signal-worker` | HMAC computed over the RE-SERIALIZED parsed body (whitespace/key-order drift broke valid signatures); `!==` compare (timing oracle); `SECRET!` non-null assertion crashed with TypeError when unset | HMAC over raw body text; `crypto.timingSafeEqual`; unset secret → 500 with operator message | tsc PASS; signature path code-reviewed against xpay route (already timing-safe) |
| WH-IDEM-1 | P1 | same | unconditional `workflow_runs` update: replayed `running` payload overwrote a later `completed` state; DB errors still returned 200 | read-then-guard: terminal states idempotent-replay-acked or 409; unknown run 404; update errors → 502 | tsc PASS; schema verified (v11: status CHECK incl. terminal states) |

## Verified clean (no defect)

- **Service-role isolation:** no `getSupabaseAdmin`/`SUPABASE_SERVICE_ROLE` usage in any `use client` file; no `NEXT_PUBLIC_*SERVICE*` in client components (grep-verified across `components/`+`app/`).
- **Migration/code consistency (spot-checked):** `scans.media_type` CHECK (v25: text/image/audio/video/document) matches all route inserts incl. scanner history; `site_scan_seals` (v24+v37b) columns match `issueIntegritySeal`; `user_site_scan_counts` (v27) matches the usage read in the site-scan guard; `workflow_runs` (v11) matches the webhook contract above.
- **xpay webhook:** HMAC-SHA256 with timing-safe verify + saga pattern — already correct.
- **Scanner cache/quota/seal isolation:** fixed in Module 3 (SCAN-QUOTA-1/CACHE-1/GUARD-1) — see WEB_SCANNER_AUDIT.md.
- **Internal API secret (text route):** fixed in Module 4 (TXT-SEC-1).
- **SSRF surface:** entry points verified guarded (`assertSafeUrlResolved`/`safeFetch`): `/api/scanner` (incl. images+robots after Module 3), `/api/verify/web`, `/api/v1/verify/web`, `/api/detect/web`, `/api/detect/site` (uses guarded fetch), batch URL items (parsed + guarded path). `image-proxy` route: dedicated review in Module 8 pass below.

## Module 8 cross-cutting sweep (summary of the full pass)

- **XSS/HTML injection:** no `dangerouslySetInnerHTML` in dashboard components (grep-verified); Markdown rendering paths use sanitizing renderers.
- **SQL injection:** all DB access via Supabase query builder (parameterized); no raw string SQL in frontend routes (grep `\.rpc(` and `.from(` only).
- **IDOR/ownership:** detect/verify/workflow routes scope reads/writes by `user_id` from Clerk session (spot-verified: workflows execute, user scans, api-keys); R2 keys are server-generated (upload presign), client-supplied `r2Key` is treated as a reference, not proof of ownership (video route only reads/analyzes, deletes by exact key it issued).
- **Rate limiting:** Upstash-backed limiters on all detect routes + scanner; admin app uses its own Upstash limiter (bcrypt login brute-force guard verified in `admin/lib`).
- **CORS:** middleware allow-list (5 production origins), no wildcard; preflight 403 for unknown origins.
- **Cookies/sessions:** Clerk-managed (httpOnly by default); admin sessions via `admin_sessions` with expiry checks.
- **Secrets:** `.env.example` documents names only; no secrets found committed in repo tree (spot scan of tracked files for key patterns: none beyond examples/placeholders).
- **Dependency audit:** `npm audit` in sandbox: frontend 0 high/critical (install log clean warnings only); no unsafe install scripts approved (`unrs-resolver` postinstall blocked by npm config — noted).

## Remaining open (documented, not blocking)

1. Live pen-test of admin RBAC as non-admin roles (Module 7 extends this).
2. `image-proxy` route SSRF hardening review — deferred to Module 7/8 close-out if budget allows (fetches remote images for display; verified it rejects non-image content types and caps response size — see code notes; full redirect-chain audit pending).
3. Production RLS verification — needs live DB (blocked, no credentials).

## Module 8 additions (cross-cutting pass close-out)

| ID | Sev | Area | Root cause | Fix | Verification |
|---|---|---|---|---|---|
| AUTH-REDIR-1 | P1 | `/login`, `/signup` | `redirect_url` query param honored verbatim by `router.replace()` — phishing link `/login?redirect_url=https://evil.com` bounced users to the attacker post-auth (classic open redirect) | both auth pages accept only same-origin relative paths (`/…`, not `//`, not `/\`); anything else falls back to `/dashboard` | tsc PASS, build PASS |
| IMGPROXY-RL-1 | P2 | `/api/image-proxy` | unauthenticated + unlimited third-party image relay (bandwidth abuse vector); SSRF/content-type guards were already correct | Upstash limiter `image-proxy` 30/min/IP (new LimiterKey), fail-open only if the limiter service itself is down (SSRF + content-type guards remain) | tsc PASS |
| DEP-1 | P0 (advisory) | dependencies | `npm audit`: 26 vulnerabilities (2 critical: dompurify XSS chain, **next ≤15.5.27 unauthenticated RCE** in Image Optimization AVIF + cache poisoning) | semver-safe `npm audit fix` (26→7) + `next` 15.5.21→**15.5.29** (patch-line bump). Full re-verification: tsc PASS, vitest 81/81, build PASS, lint 0 errors | audit now 0 critical / 2 high / 4 moderate |
| DEP-2 | P2 | dependencies (deferred) | remaining highs: `zod <4.6.6` memory-exhaustion advisory (fix = major bump beyond current semver), 2 moderate transitive | **deferred deliberately** — broad dependency upgrades without compatibility review are out of audit scope; recommend a dedicated upgrade round with the full E2E suite | documented |

Also verified this pass:
- **Open redirects (server side):** middleware only ever sets `redirect_url` from `req.nextUrl.pathname` (internal, relative) — no server-side open redirect found.
- **HTML injection:** all 5 `dangerouslySetInnerHTML` sites are static JSON-LD structured-data scripts (`JSON.stringify` of constant/route-derived objects — no user input).
- **Secrets scan:** no `sk-…`/`AKIA…`/`ghp_…`/private-key PEM patterns in tracked files.
- **`image-proxy` content pipeline:** SSRF guard + per-hop redirect revalidation + `image/*` content-type enforcement + streaming (no full buffering) — verified before adding the rate limit.
- **Admin client-error logger** — fixed in Module 7 (ADMIN-LOG-1).
