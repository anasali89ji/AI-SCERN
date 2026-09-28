// ─────────────────────────────────────────────────────────────────────────────
// ARIA — Hybrid RAG (Track 2, Item 6)
//
// Blends the existing fast keyword-scored retrieval (lib/rag/aria-rag.ts's
// retrieveContext(), synchronous, <5ms) with semantic search against a
// SEPARATE Supabase project dedicated to pgvector (see
// lib/supabase/vector-rag-admin.ts for why it's a separate project, not a
// replica, and the env vars it needs).
//
// Degrades gracefully at every layer, same pattern as the rest of this
// codebase:
//   - Vector project not configured (env vars missing)  -> semantic search
//     returns [], hybrid result is just the keyword result.
//   - HUGGINGFACE_API_TOKEN not set                       -> same as above.
//   - aria_kb_entries table not seeded yet                -> RPC returns no
//     rows above the similarity threshold, same as above.
//   - HF embedding call or Supabase RPC times out/errors  -> caught, same as
//     above.
// In every case the caller gets a valid RetrievedContext back, never a
// rejected promise.
// ─────────────────────────────────────────────────────────────────────────────
import { retrieveContext, type RetrievedContext, type KnowledgeEntry } from './aria-rag'
import { getVectorRagClient } from '@/lib/supabase/vector-rag-admin'

const EMBEDDING_MODEL = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2'
const HF_TOKEN         = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN
const SEMANTIC_TIMEOUT_MS = 2_500  // hard budget — hybridRetrieve() never waits longer than this for the semantic half

/**
 * Get a 384-dim MiniLM embedding for a text string. Deliberately a local
 * copy of the same pattern lib/rag/detection-rag.ts uses (not exported from
 * there, and that file is billing/accuracy-sensitive — not worth coupling
 * ARIA's chat KB to it just to save ~15 lines).
 */
async function embedText(text: string): Promise<number[] | null> {
  if (!HF_TOKEN) return null
  try {
    const res = await fetch(EMBEDDING_MODEL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inputs: text.slice(0, 512) }),
      signal:  AbortSignal.timeout(SEMANTIC_TIMEOUT_MS),
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

interface SemanticMatch {
  entry_id:   string
  category:   string
  content:    string
  source:     string | null
  similarity: number
}

/** Query the separate vector project. Never throws — [] on any failure. */
async function semanticSearch(query: string, topK = 5): Promise<SemanticMatch[]> {
  const client = getVectorRagClient()
  if (!client) return []

  const embedding = await embedText(query)
  if (!embedding) return []

  try {
    const { data, error } = await client.rpc('match_aria_kb_entries', {
      query_embedding: embedding,
      match_count:     topK,
      min_similarity:  0.55,
    })
    if (error || !data) return []
    return data as SemanticMatch[]
  } catch {
    return []
  }
}

/**
 * Hybrid retrieval: runs keyword scoring (instant) and semantic search
 * (bounded by SEMANTIC_TIMEOUT_MS) in parallel, then merges results —
 * de-duplicated by entry id, semantic-only matches appended after keyword
 * matches, confidence takes the higher of the two signals.
 */
export async function hybridRetrieve(query: string, topK = 5): Promise<RetrievedContext> {
  const keywordResult = retrieveContext(query, topK)

  const semanticMatches = await Promise.race([
    semanticSearch(query, topK),
    new Promise<SemanticMatch[]>((resolve) => setTimeout(() => resolve([]), SEMANTIC_TIMEOUT_MS)),
  ])

  if (semanticMatches.length === 0) {
    return keywordResult
  }

  const seenIds = new Set(keywordResult.entries.map(e => e.id))
  const semanticEntries: KnowledgeEntry[] = semanticMatches
    .filter(m => !seenIds.has(m.entry_id))
    .map(m => ({
      id:       m.entry_id,
      keywords: [],
      category: m.category,
      content:  m.content,
      source:   m.source ?? undefined,
    }))

  const bestSemanticSimilarity = Math.max(0, ...semanticMatches.map(m => m.similarity))

  return {
    entries:    [...keywordResult.entries, ...semanticEntries].slice(0, topK),
    confidence: Math.max(keywordResult.confidence, bestSemanticSimilarity),
    source:     semanticEntries.length > 0 ? 'hybrid' : keywordResult.source,
  }
}
