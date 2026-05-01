// ════════════════════════════════════════════════════════════════════════════
// AISCERN GRAPH RAG — Mini-Agent Types
// Each agent specialises in one reasoning task on the knowledge graph
// ════════════════════════════════════════════════════════════════════════════

import type { GraphNode, WebSearchResult } from '../types'

export interface AgentInput {
  query:         string
  nodes:         GraphNode[]
  searchResults: WebSearchResult[]
}

export interface AgentOutput {
  agentName:  string
  findings:   string[]
  confidence: number        // 0–1
  verdict?:   string        // optional top-level verdict from this agent
}

export interface MiniAgent {
  name: string
  run(input: AgentInput): Promise<AgentOutput>
}
