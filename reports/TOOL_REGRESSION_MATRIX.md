# TOOL REGRESSION MATRIX (Module 4)

Legend: **E2E-verified** = traced UI→API→engine→persistence with code-path evidence + automated tests where runnable; **Blocked-live** = requires external service/credentials not available in the sandbox (documented, not counted as passing).

| Tool | Route → API | Contract verified | Issues fixed this module | Status |
|---|---|---|---|---|
| Text | `/detect/text` → `/api/detect/text` | input validation, DoS rate limit, credit guard, cache (hash of full sanitized text), history insert, scan event, internal auth | **TXT-SEC-1** (P1): `X-Internal-Secret` compared with plain `===` (timing oracle) → `crypto.timingSafeEqual` with length + unset-secret guards, hoisted module-level helper | E2E-verified (code path + suite); live provider path Blocked-live |
| Image | `/detect/image` (+`/upload` R2 presign, `/finalize`) | MIME/magic validation, size caps, CV+HF worker ensemble, cache, history | **CACHE-IMG-1** (P1): cache key hashed only the first 64 KiB (`subarray(0, 65536)`) — different files sharing a 64 KiB header got the same cached verdict → `contentHash` now hashes the complete buffer (≤32 MB) or a bounded length+head+tail+samples scheme; regression tests for shared-prefix and shared-head-96 KiB files | E2E-verified (hash logic unit-tested); live worker path Blocked-live |
| Audio | `/detect/audio` | upload/R2, format policy, forensic pipeline L1–L4, cache, history-on-cache-hit (verified present) | **CACHE-AUD-1** (P1): same 64 KiB prefix hash → full-buffer hash. **AUD-PIPE-1** (P2): empty transcription still fired all 4 LLM agents on `""` (hallucinated evidence, wasted LLM spend) → L2 returns neutral agents + explicit skip note when no transcription; L1 already treats missing features as neutral 0.5 (verified, no misleading defaults) | E2E-verified; live LLM path Blocked-live |
| Video | `/detect/video` | browser frame extraction (max 12 frames enforced), R2 upload path, NVIDIA NIM primary, metadata-only fallback **honestly labeled** `engine: metadata-heuristic` + `note` prompting frame upload, 422 `FRAME_EXTRACTION_REQUIRED` when NIM unavailable | none — verified honest (no frame-level claims from metadata-only path) | E2E-verified (code path); live NIM Blocked-live |
| Document/PDF | `/detect/document`, `/api/detect/pdf` | per-format size caps (PDF 20 MB etc.), `MAX_TEXT_CHARS` 50 k, image caps (10 MB max, 3 analyzed, concurrency 3) | **DOC-ZIP-1** (P1): DOCX/PPTX decompression-bomb vector — unbounded entry count and no pre-decompress size vetting; `mammoth.extractRawText` decompressed `word/document.xml` unbounded. Added: central-directory vetting (`uncompressedSize > 25 MB` entries skipped/rejected), entry-count cap 300, slide-loop bomb guard | E2E-verified (guards compile; bomb fixtures not unit-tested — noted) |
| Batch | `/batch` → `/api/detect/batch` | max 10 items enforced, per-item try/catch with ERROR result isolation (one bad item cannot erase others), summary counts, batch history row | none — verified sound | E2E-verified (code path) |
| Web Scanner | `/scraper` → `/api/scanner` | full audit in `WEB_SCANNER_AUDIT.md` | Module 3 (9 issues) | E2E-verified (77-test suite) |
| Web Verify | `/verify/web` → `/api/verify/web`, `/api/v1/verify/web` | auth (Clerk) on internal route, API-key auth on v1, SSRF resolved-guard on both, evidence chain + audit records | none — verified present | E2E-verified (code path); live DB Blocked-live |
| ARIA chat | `/chat` → `/api/chat` (streaming) | multi-provider chain w/ explicit all-models-failed error, web-search fallback non-fatal + logged, RAG | none found in this pass (provider failure is surfaced, not faked) | E2E-verified (code path); live providers Blocked-live |
| Workflows | `/workflows` → `/api/workflows`, `/api/workflows/[id]/execute` | `auth()` + `user_id` scoping on execute, workflow_runs persistence, Inngest `executeWorkflow` | none — verified present (deep retry/idempotency audit deferred to Module 6 workers pass) | E2E-verified (code path) |
| Legacy | `/api/scraper`, `/api/detect/site` | documented in Module 1 map; no UI callers; left intact (no contract change) | — | Documented |

## Verification commands (this module)

- `npx vitest run` → **8 files / 81 tests pass** (new `detection-cache-hash.test.ts`: 4 collision/stability cases incl. >32 MB sampling path).
- `npx tsc --noEmit` → PASS · `npm run lint` → 0 errors · `npm run build` → PASS.

## Known limits (truthful)

- Live provider paths (HF, Gemini, NVIDIA, Groq, R2, Supabase writes) verified by code-path tracing + unit tests only — no credentials in sandbox.
- DOC-ZIP-1 guards are compile-verified and logically bounded; a true multi-GB bomb fixture was not constructed in the sandbox (disk limits) — recommend one adversarial fixture in CI.
