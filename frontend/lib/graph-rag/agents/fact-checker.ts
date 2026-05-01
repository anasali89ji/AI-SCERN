// ════════════════════════════════════════════════════════════════════════════
// AISCERN MINI-AGENT — FactCheckerAgent
// Cross-references claims from graph nodes against external web sources.
// Produces a list of supported / unsupported factual assertions.
// ════════════════════════════════════════════════════════════════════════════

import type { MiniAgent, AgentInput, AgentOutput } from './types'

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 3)
  )
}

function overlap(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (!ta.size || !tb.size) return 0
  const inter = [...ta].filter(t => tb.has(t)).length
  return inter / Math.max(ta.size, tb.size)
}

export const factCheckerAgent: MiniAgent = {
  name: 'FactChecker',

  async run({ nodes, searchResults }: AgentInput): Promise<AgentOutput> {
    const claimNodes = nodes.filter(n => n.type === 'claim' || n.type === 'fact')
    if (!claimNodes.length) {
      return { agentName: 'FactChecker', findings: [], confidence: 0 }
    }

    const sourceTexts = searchResults.map(r => r.snippet + ' ' + r.title)
    const findings: string[] = []
    let supportedCount = 0

    for (const claim of claimNodes.slice(0, 6)) {
      const best = Math.max(...sourceTexts.map(s => overlap(claim.content, s)))
      if (best > 0.25) {
        supportedCount++
        findings.push(`✓ Supported (${Math.round(best * 100)}%): "${claim.content.slice(0, 120)}"`)
      } else {
        findings.push(`✗ Unverified: "${claim.content.slice(0, 120)}"`)
      }
    }

    const confidence = claimNodes.length > 0 ? supportedCount / claimNodes.length : 0
    return { agentName: 'FactChecker', findings, confidence }
  },
}
