# docs/

Structural home for documentation, per the Phase 1 monorepo scaffolding
(see [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md)).

## Current source of truth (not yet moved here)

These existing root-level docs remain authoritative for now:

| Doc | Covers |
|---|---|
| [`../TRUST_PLATFORM_ARCHITECTURE.md`](../TRUST_PLATFORM_ARCHITECTURE.md) | Trust Platform architecture (trust-score engine, audit chain, verify APIs) |
| [`../SETUP.md`](../SETUP.md) | Local dev setup |
| [`../REPLICA_SETUP.md`](../REPLICA_SETUP.md) | Replica/CockroachDB setup |
| [`../SECURITY.md`](../SECURITY.md) | Security policy |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Contribution guidelines |
| [`../CHANGES.md`](../CHANGES.md) | Remediation changelog (AISCERN_MASTER_FIX_PROMPT pass) |

They are **not** moved/duplicated here yet — moving them risks breaking
existing links (README badges, CI references, bookmarks) and should happen
deliberately, file by file, not as a side effect of scaffolding.

## New structure (being filled in over time)

- [`architecture/`](./architecture) — system design docs, once split out of `TRUST_PLATFORM_ARCHITECTURE.md` and written fresh for the rest of the platform
- [`api/`](./api) — REST API reference (`/api/v1/detect/*`, `/api/v1/scan`, `/api/v1/keys`)
- [`deployment/`](./deployment) — Vercel, Cloudflare (Pages + Workers), Supabase, Convex deploy notes
- [`contributing/`](./contributing) — setup/conventions/testing, once split out of the root `CONTRIBUTING.md`
