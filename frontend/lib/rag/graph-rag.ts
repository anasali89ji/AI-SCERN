/**
 * lib/rag/graph-rag.ts — C.2 refactor
 *
 * Extracted from app/api/chat/route.ts.
 * Graph-based RAG (Retrieval-Augmented Generation) for the ARIA chat assistant.
 *
 * Builds a lightweight knowledge graph from conversation history, scores nodes
 * for relevance to the current query (with temporal decay), and returns a
 * structured XML context block for injection into the NVIDIA NIM system prompt.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode {
  id:         string
  type:       'tool' | 'verdict' | 'media' | 'topic'
  value:      string
  confidence: number
  msgIndex:   number
}

interface GraphEdge {
  from:   string
  to:     string
  rel:    'triggered' | 'produced' | 'about' | 'followup_of' | 'same_topic' | 'contradicts'
  weight: number
}

interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── Node extraction ───────────────────────────────────────────────────────────

function extractNodes(content: string, msgIndex: number, role: string): GraphNode[] {
  const nodes: GraphNode[] = []
  const lower = content.toLowerCase()
  const id = (t: string, v: string) => `${t}:${v.replace(/\s+/g, '_').slice(0, 40)}`

  // Detection tools mentioned
  const toolMap: Record<string, string> = {
    'image detection': 'detect_image', 'deepfake': 'detect_image',
    'text detection':  'detect_text',  'audio detection': 'detect_audio',
    'voice clone':     'detect_audio', 'video detection': 'detect_video',
    'batch':           'batch_analysis','pipeline': 'pipeline_stats',
    'web scanner':     'web_scan',
  }
  for (const [kw, tool] of Object.entries(toolMap)) {
    if (lower.includes(kw))
      nodes.push({ id: id('tool', tool), type: 'tool', value: tool, confidence: 0.9, msgIndex })
  }

  // Verdict mentions
  const verdictMap: Record<string, string> = {
    'ai-generated': 'AI', 'ai generated': 'AI', 'is ai': 'AI', 'looks ai': 'AI',
    'human': 'HUMAN', 'authentic': 'HUMAN', 'real': 'HUMAN',
    'uncertain': 'UNCERTAIN', 'borderline': 'UNCERTAIN', 'mixed signals': 'UNCERTAIN',
  }
  for (const [kw, verdict] of Object.entries(verdictMap)) {
    if (lower.includes(kw))
      nodes.push({ id: id('verdict', verdict), type: 'verdict', value: verdict, confidence: 0.85, msgIndex })
  }

  // Media types
  const mediaTypes = ['image', 'audio', 'video', 'text', 'document', 'pdf'] as const
  for (const m of mediaTypes) {
    if (lower.includes(m))
      nodes.push({ id: id('media', m), type: 'media', value: m, confidence: 0.7, msgIndex })
  }

  // Action topics from ARIA knowledge domain
  const topics: [string, string][] = [
    ['confidence score', 'confidence'], ['confidence', 'confidence'],
    ['accuracy', 'accuracy'], ['false positive', 'false_positive'],
    ['explain', 'explanation'], ['how it works', 'mechanism'],
    ['what is aiscern', 'platform_info'], ['who built', 'founder_info'],
    ['pricing', 'pricing'], ['api', 'api_usage'], ['batch', 'batch'],
    ['upload', 'file_upload'], ['result', 'result_interpretation'],
  ]
  for (const [kw, topic] of topics) {
    if (lower.includes(kw))
      nodes.push({ id: id('topic', topic), type: 'topic', value: topic, confidence: 0.75, msgIndex })
  }

  void role // future: role-specific scoring
  return nodes
}

// ── Edge building ─────────────────────────────────────────────────────────────

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = []
  const byMsg = new Map<number, GraphNode[]>()
  for (const n of nodes) {
    const arr = byMsg.get(n.msgIndex) || []; arr.push(n); byMsg.set(n.msgIndex, arr)
  }

  // Same-message nodes are related
  for (const [, msgNodes] of byMsg) {
    for (let i = 0; i < msgNodes.length; i++) {
      for (let j = i + 1; j < msgNodes.length; j++) {
        const a = msgNodes[i], b = msgNodes[j]
        if (a.type === 'tool' && b.type === 'verdict') {
          edges.push({ from: a.id, to: b.id, rel: 'produced',    weight: 0.9 })
        } else if (a.type === 'topic' && b.type === 'tool') {
          edges.push({ from: a.id, to: b.id, rel: 'about',       weight: 0.8 })
        } else {
          edges.push({ from: a.id, to: b.id, rel: 'same_topic',  weight: 0.6 })
        }
      }
    }
  }

  // Cross-message follow-up edges (consecutive messages)
  const msgIndices = Array.from(byMsg.keys()).sort((a, b) => a - b)
  for (let k = 1; k < msgIndices.length; k++) {
    const prevNodes = byMsg.get(msgIndices[k - 1]) || []
    const currNodes = byMsg.get(msgIndices[k])     || []
    for (const p of prevNodes) {
      for (const c of currNodes) {
        if (p.type === c.type && p.value === c.value) {
          edges.push({ from: p.id, to: c.id, rel: 'same_topic',  weight: 0.85 })
        } else if (c.type === 'topic' && c.value === 'result_interpretation') {
          edges.push({ from: p.id, to: c.id, rel: 'followup_of', weight: 0.9 })
        }
      }
    }
  }

  return edges
}

// ── BFS scoring ───────────────────────────────────────────────────────────────

function scoreNodesForQuery(graph: KnowledgeGraph, queryNodes: GraphNode[]): Map<string, number> {
  const scores = new Map<string, number>()

  for (const qn of queryNodes) {
    scores.set(qn.id, qn.confidence)
    for (const hn of graph.nodes) {
      if (hn.value === qn.value && hn.id !== qn.id)
        scores.set(hn.id, Math.max(scores.get(hn.id) || 0, qn.confidence * 0.9))
    }
  }

  // BFS propagation — 2 hops through edges
  for (let hop = 0; hop < 2; hop++) {
    for (const edge of graph.edges) {
      const fromScore = scores.get(edge.from) || 0
      const toScore   = scores.get(edge.to)   || 0
      if (fromScore > 0) scores.set(edge.to,   Math.max(toScore,   fromScore * edge.weight * 0.7))
      if (toScore   > 0) scores.set(edge.from, Math.max(fromScore, toScore   * edge.weight * 0.7))
    }
  }

  return scores
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a structured XML context string from conversation history.
 *
 * @param history  - Full message history array (role + content pairs)
 * @param currentMsg - The user's current message (used to score relevance)
 * @returns XML string for injection into the NVIDIA NIM system prompt,
 *          or empty string if no relevant context found.
 */
export function buildGraphRAGContext(history: { role: string; content: unknown }[], currentMsg: string): string {
  if (!history?.length) return ''

  const graph: KnowledgeGraph = { nodes: [], edges: [] }

  // Deduplicate nodes by id (keep most recent msgIndex) — FIX 3.3
  const nodeMap = new Map<string, GraphNode>()
  for (let i = 0; i < history.length; i++) {
    const content = typeof history[i].content === 'string' ? history[i].content as string : ''
    if (!content) continue
    for (const node of extractNodes(content, i, history[i].role)) {
      const existing = nodeMap.get(node.id)
      if (!existing || node.msgIndex > existing.msgIndex) nodeMap.set(node.id, node)
    }
  }
  graph.nodes.push(...nodeMap.values())

  if (!graph.nodes.length) return ''
  graph.edges = buildEdges(graph.nodes)

  const queryNodes = extractNodes(currentMsg, 999, 'user')
  const scores     = scoreNodesForQuery(graph, queryNodes)

  // Temporal decay — ~50% weight at 9 messages ago — FIX 3.1
  const CURRENT_IDX = history.length
  for (const [nodeId, score] of scores.entries()) {
    const node = graph.nodes.find(n => n.id === nodeId)
    if (node) {
      const age = CURRENT_IDX - node.msgIndex
      scores.set(nodeId, score * Math.exp(-0.08 * age))
    }
  }

  const topNodes = graph.nodes
    .map(n => ({ ...n, score: scores.get(n.id) || 0 }))
    .filter(n => n.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  if (!topNodes.length) return ''

  const byType: Record<string, string[]> = {}
  for (const n of topNodes) {
    if (!byType[n.type]) byType[n.type] = []
    byType[n.type].push(n.value)
  }

  // Structured XML injection — FIX 3.2
  const xmlLines = ['<conversation_context>']
  if (byType.tool)    xmlLines.push(`  <tools_used>${[...new Set(byType.tool)].join(', ')}</tools_used>`)
  if (byType.verdict) xmlLines.push(`  <verdicts_seen>${[...new Set(byType.verdict)].join(', ')}</verdicts_seen>`)
  if (byType.media)   xmlLines.push(`  <media_types>${[...new Set(byType.media)].join(', ')}</media_types>`)
  if (byType.topic)   xmlLines.push(`  <topics>${[...new Set(byType.topic)].map(t => t.replace(/_/g, ' ')).join(', ')}</topics>`)

  for (let i = history.length - 1; i >= 0; i--) {
    const c = typeof history[i]?.content === 'string' ? history[i].content as string : ''
    if (c.includes('Verdict:') && c.includes('Confidence:')) {
      const verdict = c.match(/Verdict:\s*(.+)/)?.[1]?.slice(0, 60) || ''
      const conf    = c.match(/Confidence:\s*(.+)/)?.[1]?.slice(0, 20) || ''
      xmlLines.push(`  <last_scan verdict="${verdict}" confidence="${conf}" messages_ago="${history.length - 1 - i}" />`)
      break
    }
  }

  xmlLines.push('</conversation_context>')
  return xmlLines.join('\n')
}
