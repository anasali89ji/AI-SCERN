/**
 * POST /api/admin/seed-aria-kb
 *
 * One-time (and re-runnable) seeding job: embeds every entry in
 * lib/rag/aria-rag.ts's KNOWLEDGE_BASE via the free HuggingFace
 * sentence-transformers/all-MiniLM-L6-v2 model and upserts them into the
 * SEPARATE vector-RAG Supabase project's aria_kb_entries table (see
 * lib/supabase/vector-rag-admin.ts for why it's a separate project).
 *
 * Safe to re-run: upserts on entry_id, so editing/adding KB entries in
 * aria-rag.ts and re-running this re-embeds only what's needed (though it
 * currently re-embeds everything for simplicity — the KB is small, ~35
 * entries, and HF's free tier handles that in well under a minute).
 *
 * Requires HUGGINGFACE_API_TOKEN (or HF_TOKEN) and
 * ARIA_VECTOR_SUPABASE_URL / ARIA_VECTOR_SUPABASE_SERVICE_KEY to be set —
 * without them this returns a clear error rather than silently no-op'ing
 * (unlike the read-path in hybrid-rag.ts, which degrades silently by
 * design — a seed job that silently does nothing would be confusing to
 * debug).
 */
import { NextResponse } from 'next/server'
import { verifyAdmin, isAdminError } from '@/lib/auth/verify-admin'
import { KNOWLEDGE_BASE } from '@/lib/rag/aria-rag'
import { getVectorRagClient } from '@/lib/supabase/vector-rag-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const EMBEDDING_MODEL = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2'
const HF_TOKEN         = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN

async function embedText(text: string): Promise<number[] | null> {
  if (!HF_TOKEN) return null
  try {
    const res = await fetch(EMBEDDING_MODEL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inputs: text.slice(0, 512) }),
      signal:  AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const embedding = Array.isArray(data[0]) ? data[0] : data
    if (!Array.isArray(embedding) || embedding.length !== 384) return null
    return embedding as number[]
  } catch {
    return null
  }
}

export async function POST() {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  if (!HF_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'HUGGINGFACE_API_KEY (or HUGGINGFACE_API_TOKEN/HF_TOKEN) is not set — cannot generate embeddings.' },
      { status: 500 },
    )
  }

  const client = getVectorRagClient()
  if (!client) {
    return NextResponse.json(
      { success: false, error: 'ARIA_VECTOR_SUPABASE_URL / ARIA_VECTOR_SUPABASE_SERVICE_KEY not set — vector-rag project not configured.' },
      { status: 500 },
    )
  }

  const results: Array<{ entry_id: string; status: 'ok' | 'embed_failed' | 'upsert_failed'; detail?: string }> = []

  // Sequential, not Promise.all — HF's free inference tier rate-limits
  // aggressively on bursts; ~35 entries sequentially is well within maxDuration.
  for (const entry of KNOWLEDGE_BASE) {
    const embedding = await embedText(entry.content)
    if (!embedding) {
      results.push({ entry_id: entry.id, status: 'embed_failed' })
      continue
    }

    const { error } = await client.from('aria_kb_entries').upsert(
      {
        entry_id:  entry.id,
        category:  entry.category,
        content:   entry.content,
        keywords:  entry.keywords,
        source:    entry.source ?? null,
        embedding: JSON.stringify(embedding),  // Supabase accepts a JSON array for vector columns
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entry_id' },
    )

    results.push(
      error
        ? { entry_id: entry.id, status: 'upsert_failed', detail: error.message }
        : { entry_id: entry.id, status: 'ok' },
    )
  }

  const okCount = results.filter(r => r.status === 'ok').length
  return NextResponse.json({
    success: true,
    seeded: okCount,
    total:  KNOWLEDGE_BASE.length,
    failures: results.filter(r => r.status !== 'ok'),
  })
}
