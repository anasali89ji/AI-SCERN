// ════════════════════════════════════════════════════════════════════════════
// AISCERN GRAPH RAG — Knowledge Graph Builder + Traversal
// Builds an in-memory knowledge graph from web sources + page content
// Traverses it to extract the most relevant context for the LLM
// ════════════════════════════════════════════════════════════════════════════

import type {
  KnowledgeGraph, GraphNode, GraphEdge, WebSearchResult, EdgeRelation
} from './types'
import { domainCredibility } from './web-search'
import { extractClaims, extractEntities } from './entity-extractor'
import { nanoid } from 'nanoid'

// ── Node factory helpers ──────────────────────────────────────────────────────
function makeNode(partial: Omit<GraphNode, 'id' | 'relevance' | 'confidence' | 'metadata'> & Partial<GraphNode>): GraphNode {
  return {
    id:         partial.id         ?? nanoid(8),
    type:       partial.type,
    content:    partial.content,
    url:        partial.url,
    domain:     partial.domain,
    title:      partial.title,
    date:       partial.date,
    relevance:  partial.relevance  ?? 0.5,
    confidence: partial.confidence ?? 0.5,
    metadata:   partial.metadata   ?? {},
  }
}

function makeEdge(from: string, to: string, relation: EdgeRelation, weight: number): GraphEdge {
  return { from, to, relation, weight }
}

// ── Build graph from search results + fetched page content ───────────────────
export function buildGraph(
  queryText:      string,
  searchResults:  WebSearchResult[],
  fetchedPages:   Array<{ url: string; content: string }>,
  mainPageContent?: string,   // The scanned page's content (scan mode)
): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  // ── Root: query node ─────────────────────────────────────────────────────
  const queryNode = makeNode({
    id:         'query_root',
    type:       'query',
    content:    queryText,
    relevance:  1.0,
    confidence: 1.0,
  })
  nodes.set(queryNode.id, queryNode)

  // ── Source nodes (from search snippets) ──────────────────────────────────
  for (const result of searchResults) {
    const sourceId = `src_${nanoid(6)}`
    const credScore = domainCredibility(result.domain)
    const sourceNode = makeNode({
      id:         sourceId,
      type:       'source',
      content:    result.snippet,
      url:        result.url,
      domain:     result.domain,
      title:      result.title,
      date:       result.date,
      relevance:  computeRelevance(result.snippet + ' ' + result.title, queryText),
      confidence: credScore,
    })
    nodes.set(sourceId, sourceNode)
    edges.push(makeEdge('query_root', sourceId, 'related_to', sourceNode.relevance))

    // ── Claim nodes extracted from snippet ──────────────────────────────────
    const snippetClaims = extractClaims(result.snippet, 3)
    for (const claimText of snippetClaims) {
      const claimId = `claim_${nanoid(6)}`
      const claimNode = makeNode({
        id:         claimId,
        type:       'claim',
        content:    claimText,
        url:        result.url,
        domain:     result.domain,
        relevance:  computeRelevance(claimText, queryText),
        confidence: credScore * 0.85,  // slightly less confident than the source
      })
      nodes.set(claimId, claimNode)
      edges.push(makeEdge(sourceId, claimId, 'mentions', 0.8))
    }

    // ── Entity nodes from snippet ────────────────────────────────────────────
    const snippetEntities = extractEntities(result.snippet, 4)
    for (const entity of snippetEntities) {
      const entityKey = `entity_${entity.text.toLowerCase().replace(/\s+/g, '_')}`
      if (!nodes.has(entityKey)) {
        const entityNode = makeNode({
          id:         entityKey,
          type:       'entity',
          content:    entity.text,
          relevance:  computeRelevance(entity.text, queryText) * (entity.count / 3),
          confidence: 0.7,
          metadata:   { entityType: entity.type, count: entity.count },
        })
        nodes.set(entityKey, entityNode)
      } else {
        // Boost existing entity's relevance
        const existing = nodes.get(entityKey)!
        existing.relevance = Math.min(1, existing.relevance + 0.1)
      }
      edges.push(makeEdge(sourceId, entityKey, 'mentions', 0.6))
    }
  }

  // ── Deep content nodes (from fully-fetched pages) ────────────────────────
  for (const { url, content } of fetchedPages) {
    if (!content || content.length < 100) continue
    const deepClaims = extractClaims(content, 5)
    const deepEntities = extractEntities(content, 6)
    const cred = domainCredibility(extractDomainFromUrl(url))

    // Stat nodes — extract numerical facts
    const statRe = /[A-Z][^.!?]*\b\d+(?:\.\d+)?(?:%|million|billion|thousand|percent)[^.!?]*[.!?]/g
    const statMatches = content.match(statRe) || []
    for (const stat of statMatches.slice(0, 3)) {
      const statId = `stat_${nanoid(6)}`
      nodes.set(statId, makeNode({
        id:         statId,
        type:       'stat',
        content:    stat.trim(),
        url,
        relevance:  computeRelevance(stat, queryText),
        confidence: cred,
      }))
      const parentSrc = findSourceNodeForUrl(nodes, url)
      if (parentSrc) edges.push(makeEdge(parentSrc, statId, 'derived_from', 0.9))
    }

    for (const claim of deepClaims) {
      const claimId = `deep_${nanoid(6)}`
      nodes.set(claimId, makeNode({
        id:         claimId,
        type:       'fact',
        content:    claim,
        url,
        relevance:  computeRelevance(claim, queryText),
        confidence: cred * 0.9,
      }))
      const parentSrc = findSourceNodeForUrl(nodes, url)
      if (parentSrc) edges.push(makeEdge(parentSrc, claimId, 'derived_from', 0.85))
    }

    // Link entities across pages (co-occurrence = relationship)
    for (const e1 of deepEntities.slice(0, 3)) {
      for (const e2 of deepEntities.slice(1, 4)) {
        if (e1.text === e2.text) continue
        const k1 = `entity_${e1.text.toLowerCase().replace(/\s+/g, '_')}`
        const k2 = `entity_${e2.text.toLowerCase().replace(/\s+/g, '_')}`
        if (nodes.has(k1) && nodes.has(k2)) {
          edges.push(makeEdge(k1, k2, 'co_occurs_with', 0.5))
        }
      }
    }
  }

  // ── Main page content (scan mode) ────────────────────────────────────────
  if (mainPageContent) {
    const pageClaims = extractClaims(mainPageContent, 6)
    for (const claim of pageClaims) {
      const pageClaimId = `page_claim_${nanoid(6)}`
      const rel = computeRelevance(claim, queryText)
      nodes.set(pageClaimId, makeNode({
        id:         pageClaimId,
        type:       'claim',
        content:    claim,
        relevance:  rel,
        confidence: 0.5,   // unknown credibility — that's what we're investigating
        metadata:   { source: 'scanned_page' },
      }))
      edges.push(makeEdge('query_root', pageClaimId, 'related_to', rel))

      // Try to find corroborating/contradicting sources
      for (const [nodeId, node] of nodes) {
        if (node.type !== 'source' && node.type !== 'fact') continue
        const overlap = tokenOverlap(claim, node.content)
        if (overlap > 0.3) {
          const relation: EdgeRelation = node.confidence > 0.7 ? 'supports' : 'related_to'
          edges.push(makeEdge(pageClaimId, nodeId, relation, overlap))
        }
      }
    }
  }

  return { nodes, edges, queryNode: 'query_root', createdAt: Date.now() }
}

// ── Graph traversal: extract top-k most relevant nodes ───────────────────────
export function traverseGraph(
  graph:    KnowledgeGraph,
  maxNodes: number = 20,
): GraphNode[] {
  // Score nodes using: relevance * confidence * degree centrality
  const degreeCounts = new Map<string, number>()
  for (const edge of graph.edges) {
    degreeCounts.set(edge.from, (degreeCounts.get(edge.from) || 0) + edge.weight)
    degreeCounts.set(edge.to,   (degreeCounts.get(edge.to)   || 0) + edge.weight)
  }

  const maxDegree = Math.max(...degreeCounts.values(), 1)

  const scored = Array.from(graph.nodes.values())
    .filter(n => n.id !== 'query_root')
    .map(n => {
      const degree = (degreeCounts.get(n.id) || 0) / maxDegree
      const score = (n.relevance * 0.5) + (n.confidence * 0.3) + (degree * 0.2)
      return { node: n, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxNodes).map(x => x.node)
}

// ── Format graph context for LLM injection ────────────────────────────────────
export function formatGraphContext(
  topNodes:       GraphNode[],
  searchResults:  WebSearchResult[],
  queryText:      string,
  mode:           'chat' | 'scan',
): string {
  const sections: string[] = []

  // 1. Real-time web search summary
  const sources = searchResults
    .slice(0, 6)
    .map(r => `• [${r.domain}] ${r.title}\n  ${r.snippet.slice(0, 250)}`)
    .join('\n')
  if (sources) {
    sections.push(`REAL-TIME WEB SOURCES (fetched now):\n${sources}`)
  }

  // 2. Key facts extracted from the graph (stats + verified facts)
  const facts = topNodes
    .filter(n => n.type === 'fact' || n.type === 'stat')
    .slice(0, 8)
    .map(n => `• ${n.content}${n.domain ? ` [${n.domain}]` : ''}`)
    .join('\n')
  if (facts) sections.push(`KEY FACTS FROM SOURCES:\n${facts}`)

  // 3. Entities mentioned across multiple sources (cross-referenced)
  const entities = topNodes
    .filter(n => n.type === 'entity')
    .slice(0, 8)
    .map(n => n.content)
    .join(', ')
  if (entities) sections.push(`KEY ENTITIES IDENTIFIED: ${entities}`)

  // 4. Scan mode: page claim verification
  if (mode === 'scan') {
    const pageClaims = topNodes.filter(n => n.type === 'claim' && n.metadata?.source === 'scanned_page')
    const supported = pageClaims.filter(n => {
      // Check if any source node supports it
      return topNodes.some(other =>
        other.type === 'source' &&
        tokenOverlap(n.content, other.content) > 0.25
      )
    })
    const unverified = pageClaims.filter(n => !supported.includes(n))

    if (supported.length > 0) {
      sections.push(
        `CLAIMS FOUND IN EXTERNAL SOURCES (${supported.length}):\n` +
        supported.slice(0, 4).map(n => `• ${n.content.slice(0, 200)}`).join('\n')
      )
    }
    if (unverified.length > 0) {
      sections.push(
        `UNVERIFIED CLAIMS (no external source found, ${unverified.length}):\n` +
        unverified.slice(0, 3).map(n => `• ${n.content.slice(0, 200)}`).join('\n')
      )
    }
  }

  return sections.join('\n\n─────────────────────────────\n\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Lightweight TF-IDF-like relevance: token overlap between text and query
function computeRelevance(text: string, query: string): number {
  const queryTokens = tokenize(query)
  const textTokens  = new Set(tokenize(text))
  if (queryTokens.length === 0) return 0.3
  const overlap = queryTokens.filter(t => textTokens.has(t)).length
  return Math.min(1, overlap / queryTokens.length + 0.1)
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3)
    .filter(t => !STOP_WORDS.has(t))
}

function tokenOverlap(a: string, b: string): number {
  const tokA = new Set(tokenize(a))
  const tokB = new Set(tokenize(b))
  if (tokA.size === 0 || tokB.size === 0) return 0
  const intersection = [...tokA].filter(t => tokB.has(t)).length
  return intersection / Math.max(tokA.size, tokB.size)
}

function extractDomainFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function findSourceNodeForUrl(nodes: Map<string, GraphNode>, url: string): string | null {
  for (const [id, node] of nodes) {
    if (node.type === 'source' && node.url === url) return id
  }
  return null
}

const STOP_WORDS = new Set([
  'that','this','with','from','have','been','will','would','could','should',
  'they','their','there','were','what','when','where','which','who','whom',
  'into','onto','over','under','about','above','below','between','through',
  'before','after','during','since','until','while','because','although',
  'however','therefore','moreover','furthermore','additionally',
])
