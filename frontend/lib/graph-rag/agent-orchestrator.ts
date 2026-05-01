// ════════════════════════════════════════════════════════════════════════════
// AISCERN GRAPH RAG — Mini-Agent Orchestrator
// Runs the appropriate mini-agents in parallel based on mode (chat vs scan).
// Formats their combined output for injection into the LLM system prompt.
// ════════════════════════════════════════════════════════════════════════════

import type { KnowledgeGraph, WebSearchResult } from './types'
import { traverseGraph } from './graph-builder'
import type { AgentInput } from './agents/types'
import { factCheckerAgent }        from './agents/fact-checker'
import { sourceCredibilityAgent }  from './agents/source-credibility'
import { entityLinkerAgent }       from './agents/entity-linker'
import { trendAgent }              from './agents/trend-agent'
import { contradictionAgent }      from './agents/contradiction'

export async function runMiniAgents(
  query:   string,
  graph:   KnowledgeGraph,
  results: WebSearchResult[],
  mode:    'chat' | 'scan',
): Promise<string> {
  const topNodes = traverseGraph(graph, 20)
  const input: AgentInput = { query, nodes: topNodes, searchResults: results }

  // Select agents based on mode
  const agents = mode === 'scan'
    ? [factCheckerAgent, sourceCredibilityAgent, entityLinkerAgent, contradictionAgent]
    : [entityLinkerAgent, trendAgent, sourceCredibilityAgent]

  // Run all selected agents in parallel, never throw
  const outputs = await Promise.all(
    agents.map(a => a.run(input).catch(() => null))
  )

  const lines: string[] = ['[MINI AGENT ANALYSIS]']
  for (const output of outputs) {
    if (!output || !output.findings.length) continue
    const verdictStr = output.verdict ? ` | verdict: ${output.verdict}` : ''
    lines.push(`[${output.agentName}${verdictStr}]:`)
    for (const finding of output.findings.slice(0, 4)) {
      lines.push(`  ${finding}`)
    }
  }

  return lines.length > 1 ? lines.join('\n') : ''
}
