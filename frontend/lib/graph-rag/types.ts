// ════════════════════════════════════════════════════════════════════════════
// AISCERN GRAPH RAG — Core Types
// Knowledge graph built from real-time internet sources + page content
// ════════════════════════════════════════════════════════════════════════════

export type NodeType =
  | 'entity'     // Named entity: person, org, technology, product
  | 'claim'      // A factual assertion from a page/source
  | 'source'     // A web document (URL + title)
  | 'query'      // The user's original query (root node)
  | 'fact'       // Verified/cross-referenced claim
  | 'stat'       // Numerical statistic or data point

export type EdgeRelation =
  | 'mentions'       // Source mentions entity
  | 'supports'       // Source/fact supports a claim
  | 'contradicts'    // Source/fact contradicts a claim
  | 'related_to'     // Two entities are topically related
  | 'derived_from'   // Claim derived from source
  | 'co_occurs_with' // Two entities appear together frequently
  | 'updated_by'     // A fact supersedes an older claim

export interface GraphNode {
  id:         string
  type:       NodeType
  content:    string        // The textual content of this node
  url?:       string        // Source URL (for source/claim nodes)
  domain?:    string        // Domain name of source
  title?:     string        // Page/document title
  date?:      string        // Publication date if available
  relevance:  number        // 0–1: how relevant to the query
  confidence: number        // 0–1: how trustworthy is this node
  metadata:   Record<string, any>
}

export interface GraphEdge {
  from:     string       // Node ID
  to:       string       // Node ID
  relation: EdgeRelation
  weight:   number       // 0–1 edge strength
}

export interface KnowledgeGraph {
  nodes:     Map<string, GraphNode>
  edges:     GraphEdge[]
  queryNode: string          // ID of the root query node
  createdAt: number
}

export interface WebSearchResult {
  title:    string
  url:      string
  snippet:  string
  domain:   string
  date?:    string
}

export interface RagContext {
  // Structured context ready to inject into LLM system prompt
  summary:          string
  sources:          WebSearchResult[]
  keyFacts:         string[]
  entities:         string[]
  contradictions:   string[]
  freshness:        'live' | 'cached' | 'none'
  searchTerms:      string[]
  graphNodeCount:   number
  graphEdgeCount:   number
}

export interface GraphRagOptions {
  maxSearchTerms:   number   // How many search queries to run (default 3)
  maxResultsPerTerm:number   // Search results per term (default 5)
  maxFetchDepth:    number   // How many pages to actually fetch (default 3)
  maxContextTokens: number   // Approx chars for LLM context (default 6000)
  timeout:          number   // Total timeout ms (default 25000)
  mode:             'chat' | 'scan'  // Affects what gets injected
}
