import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Separate Supabase project for ARIA's pgvector knowledge base, deliberately
// isolated from the main app database (detectai-v2) per explicit request —
// not a replica, a distinct project (ref: rciimoimzifqgnrondyz, "aiscern-vector-rag",
// same ap-southeast-1 region as the main project to keep cross-project
// latency down). Schema: aria_kb_entries + match_aria_kb_entries() RPC —
// mirrors the shape of the main project's detection_embeddings /
// match_detection_embeddings so the embedding helper can be shared in spirit
// even though this project's client/table are separate.
//
// New env vars required (NOT the same as NEXT_PUBLIC_SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY, which point at detectai-v2):
//   ARIA_VECTOR_SUPABASE_URL          = https://rciimoimzifqgnrondyz.supabase.co
//   ARIA_VECTOR_SUPABASE_SERVICE_KEY  = <service_role key from that project's dashboard>
//
// The service role key isn't retrievable through the Supabase MCP tool (by
// design — it's not exposed for security reasons); grab it from
// https://supabase.com/dashboard/project/rciimoimzifqgnrondyz/settings/api
// and add it to Vercel's env vars for this project. Until that's set, every
// function in this module degrades to returning null/empty — see
// hybrid-rag.ts, which treats "vector project not configured" the same as
// "no results found", not an error.
// ─────────────────────────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null

export function getVectorRagClient(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.ARIA_VECTOR_SUPABASE_URL
  const key = process.env.ARIA_VECTOR_SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}
