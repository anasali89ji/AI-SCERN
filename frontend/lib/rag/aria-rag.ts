/**
 * lib/rag/aria-rag.ts — Module A.1
 *
 * Lightweight retrieval layer for ARIA's static knowledge base.
 * Runs BEFORE the NIM call to determine:
 *   (a) whether ARIA can answer directly from the KB without hitting NVIDIA at all
 *       (RAG-direct bypass, A.1.2 — reduces cold-start delay by 30-90s for
 *        common FAQ queries like "who built aiscern" or "how accurate is image detection")
 *   (b) what KB snippets to inject into the system prompt as <knowledge> context
 *
 * Retrieval uses a two-level strategy:
 *   1. Embedding similarity (cosine) — when HF_TOKEN is set AND embeddings
 *      have been precomputed via `npm run aria:embed`. Scores every chunk.
 *   2. BM25-style keyword/tag scoring — always available, no network calls.
 *      Falls back to this when embeddings are null or HF is unavailable.
 *
 * The two strategies are combined: embedding_score * 0.7 + keyword_score * 0.3
 * when embeddings are available, otherwise keyword_score alone.
 *
 * Direct-answer bypass fires when top_score >= DIRECT_THRESHOLD (0.80) AND:
 *   - The query is clearly an FAQ / knowledge question (not a detection request)
 *   - The chunk has a non-null direct_answer field
 *
 * Important: the bypass is conservative — it only fires on high-confidence
 * matches to avoid replacing nuanced NVIDIA responses with stale KB copy.
 */

import knowledgeBase from './aria-knowledge.json'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KBChunk {
  id:             string
  title:          string
  tags:           string[]
  body:           string
  direct_answer:  string | null
  embedding:      number[] | null
}

export interface RAGRetrievalResult {
  /** Chunks to inject as <knowledge> context into the system prompt */
  contextChunks:    KBChunk[]
  /** Whether the direct-answer bypass should fire (skip NIM, respond from KB) */
  bypassNIM:        boolean
  /** The direct answer to stream to the user (only set when bypassNIM === true) */
  directAnswer:     string | null
  /** Top retrieval score (0–1) for telemetry / debug headers */
  topScore:         number
}

// ── Config ────────────────────────────────────────────────────────────────────

const TOP_K            = 3     // max chunks to inject into system prompt
const DIRECT_THRESHOLD = 0.80  // cosine/keyword score above which we bypass NIM
const INJECT_THRESHOLD = 0.40  // minimum score to include a chunk in system prompt context
const HF_TOKEN         = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
const EMBED_URL        = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2'

const KB: KBChunk[] = (knowledgeBase as { chunks: KBChunk[] }).chunks

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedQuery(query: string): Promise<number[] | null> {
  if (!HF_TOKEN) return null
  try {
    const res = await fetch(EMBED_URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inputs: query.slice(0, 256) }),
      signal:  AbortSignal.timeout(4_000),   // short timeout — must not block the chat response
    })
    if (!res.ok) return null
    const data = await res.json()
    const emb  = Array.isArray(data[0]) ? data[0] : data
    return Array.isArray(emb) && emb.length === 384 ? (emb as number[]) : null
  } catch {
    return null
  }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

// ── Keyword / BM25-style scorer ───────────────────────────────────────────────
// Simple but effective: score by how many of the chunk's tags appear in the
// query, normalized by tag count. Handles plural/stemming with substring match.

function keywordScore(query: string, chunk: KBChunk): number {
  const q = query.toLowerCase()
  let hits = 0
  for (const tag of chunk.tags) {
    if (q.includes(tag.toLowerCase())) hits++
  }
  if (!hits) return 0
  // Soft TF score: each additional tag hit adds diminishing returns
  return Math.min(1, 0.3 + (hits / chunk.tags.length) * 0.7)
}

// Detect if the query looks like a detection-request (image attached / "analyze
// this" / "check this") vs a knowledge question. We only fire the direct bypass
// for knowledge questions — detection requests always go to NIM.
function isKnowledgeQuery(query: string): boolean {
  const q = query.toLowerCase()
  const detectionKeywords = [
    'analyze this', 'analyse this', 'check this', 'detect this',
    'is this ai', 'is this real', 'scan this', 'look at this',
    'uploaded', 'attached', 'file',
  ]
  return !detectionKeywords.some(kw => q.includes(kw))
}

// ── Main retrieval function ───────────────────────────────────────────────────

export async function retrieveARIAKnowledge(
  query:   string,
  history: { role: string; content: string }[] = [],
): Promise<RAGRetrievalResult> {
  const noOp: RAGRetrievalResult = {
    contextChunks: [], bypassNIM: false, directAnswer: null, topScore: 0,
  }

  if (!query.trim()) return noOp

  // Expand query with last assistant turn for follow-up awareness
  const lastAssist = [...history].reverse().find(m => m.role === 'assistant')?.content?.slice(0, 200) ?? ''
  const expandedQ  = lastAssist ? `${query} ${lastAssist}` : query

  // ── Embedding scores (optional) ───────────────────────────────────────────
  const queryEmbedding = await embedQuery(expandedQ)

  const scored = KB.map(chunk => {
    const kw = keywordScore(expandedQ, chunk)

    if (queryEmbedding && chunk.embedding) {
      const cosine = cosineSim(queryEmbedding, chunk.embedding)
      return { chunk, score: cosine * 0.7 + kw * 0.3 }
    }
    return { chunk, score: kw }
  })

  scored.sort((a, b) => b.score - a.score)

  const topScore = scored[0]?.score ?? 0
  const relevant = scored.filter(s => s.score >= INJECT_THRESHOLD).slice(0, TOP_K)

  if (!relevant.length) return { ...noOp, topScore }

  // ── Direct-answer bypass (A.1.2) ─────────────────────────────────────────
  const top = scored[0]
  const bypassNIM = (
    topScore >= DIRECT_THRESHOLD &&
    top.chunk.direct_answer !== null &&
    isKnowledgeQuery(query)
  )

  return {
    contextChunks: relevant.map(s => s.chunk),
    bypassNIM,
    directAnswer:  bypassNIM ? top.chunk.direct_answer : null,
    topScore,
  }
}

// ── System-prompt injection helper ───────────────────────────────────────────

/**
 * Format retrieved KB chunks into a compact XML block for system prompt injection.
 * Placed BEFORE the graph-RAG <conversation_context> so the LLM sees factual
 * Aiscern knowledge first.
 */
export function formatKBContext(chunks: KBChunk[]): string {
  if (!chunks.length) return ''
  const items = chunks
    .map(c => `  <item id="${c.id}" title="${c.title}">\n    ${c.body.replace(/\n/g, '\n    ')}\n  </item>`)
    .join('\n')
  return `<aiscern_knowledge>\n${items}\n</aiscern_knowledge>`
}
