# ADMIN DASHBOARD AUDIT (Module 7)

**Scope:** `admin/` app — 24 tabs, 46 API routes, own middleware + auth chain. Build verified (Next 14.2.35). Admin lint/type-check remain coverage gaps (G-2/G-3, BASELINE.md).

## Auth chain (verified end-to-end, code path)

1. `admin/middleware.ts`: every route except `/`, `/api/auth`, `/api/log-client-error`, `/_next/*` requires a valid `admin_session` cookie → `verifyAdminSession()`.
2. `lib/auth.ts`: HMAC-SHA256 session tokens (Web Crypto, edge-safe) — `admin:{ip}:{ts}:{adminId}:{sig}`; **constant-time** signature compare; 2 h TTL; bcrypt password support (`ADMIN_PASSWORD_BCRYPT`) + plaintext fallback; ≥32-char session secret enforced; server-side **revocation table check on every request** (fail-closed on DB error — correct for admin auth; per-request DB cost is acceptable at admin-panel traffic levels and is a deliberate security/latency trade-off, documented here).
3. `lib/admin-middleware.ts` `requireAdmin(req, permission)`: session verify + role lookup (`admin_users.role`) + `PERMISSIONS` map (admin/moderator/super_admin; unknown/deleted admin → deny-by-default `viewer`); legacy env-password admin = super_admin (documented). `logAdminAction()` writes `admin_activity_logs`.

## API route authorization (46 routes, programmatic scan)

- **44/46 routes** call `requireAdmin(req, '<permission>')` with granular permissions: `settings:read` ×24, `settings:write` ×22, `users:write` ×4, `scans:read` ×3, `admins:manage` ×3, `users:read` ×2, `content:moderate` ×2, `errors:read/write` ×2 — mutations consistently demand `:write`.
- **2 intentionally public:** `/api/auth` (login itself — bcrypt + Upstash brute-force limiter, verified in deps) and `/api/log-client-error` (must log errors from the pre-login page).

## Fixed this module

| ID | Sev | Area | Root cause | Fix |
|---|---|---|---|---|
| ADMIN-LOG-1 | **P2** | `/api/log-client-error` (the admin app's only unauthenticated write path) | no rate limit, no payload caps, unguarded `req.json()` — attacker could flood `error_logs` (each unique message/path pair < 1 h old = one row, unbounded length) or 500 on malformed JSON | per-IP in-memory limiter (10/min, self-sweeping map), field caps (message 2 000 / stack 4 000 / path 500 / UA 300), safe JSON parse, 400 on missing message; build PASS |

## Tabs (24) — structural verification

All tabs render from `app/dashboard/tabs/*` through `useSWR` + shared `lib/api-client.ts`; every data endpoint they consume is in the guarded 44 (verified by the programmatic scan above — no tab calls an unguarded route besides `/api/auth` for logout). Verified in code: server-side RBAC is NOT replicated by client-side hiding alone — the permission map is enforced in `requireAdmin` before any DB access.

Tab-by-tab live behavior (CRUD round-trips, pagination, exports, empty/error states) is **blocked-live** in this sandbox: requires a deployed admin instance with Supabase credentials. The two export flows (`/api/users/export`, `/api/scans/export`) were code-reviewed: both demand `users:read`/`scans:read` and stream CSV from scoped queries.

## Notable verified behaviors

- Destructive ops (user ban/delete, maintenance toggle) require `:write` permissions and are audit-logged via `logAdminAction`.
- Session revocation is immediate (revocation table checked per request) — logging out one device does not depend on cookie expiry.
- `admin_sessions` rows carry `expires_at` — TTL enforced both in token HMAC payload and in DB.

## Remaining / blocked

- Live role-matrix test (unauthenticated → 401, customer-token → 401, moderator on admin-only mutation → 403) — needs deployment; code path verified instead.
- Admin ESLint config + type-check script (G-2/G-3) — recommend adding `.eslintrc.json` (`next/core-web-vitals`) and a `type-check` script in a follow-up; not added in this audit round to avoid altering the admin build pipeline without a live verification target.
