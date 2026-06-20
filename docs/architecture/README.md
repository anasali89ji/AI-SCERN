# docs/architecture/

Target layout (to be filled in over time, not written speculatively here):

- `overview.md` — system overview / how the apps fit together
- `data-flow.md` — request lifecycle for a scan (upload → R2 → inference → Supabase → result)
- `inference-pipeline.md` — HF / Gemini / NVIDIA NIM fallback chain, RAG retrieval
- `security-model.md` — auth (Clerk), RLS, CORS, file validation, admin role enforcement

For now, [`../../TRUST_PLATFORM_ARCHITECTURE.md`](../../TRUST_PLATFORM_ARCHITECTURE.md)
is the real, current architecture doc (Trust Platform: trust-score engine,
audit chain, verify APIs). Don't duplicate it here until it's being split
up deliberately — see `../MIGRATION_STATUS.md`.
