// ════════════════════════════════════════════════════════════════════════════
// AISCERN MINI-AGENT — SourceCredibilityAgent
// Evaluates the trustworthiness of web sources found in the graph.
// Flags low-credibility domains and known AI content farms.
// ════════════════════════════════════════════════════════════════════════════

import type { MiniAgent, AgentInput, AgentOutput } from './types'
import { domainCredibility } from '../web-search'

// Known AI content farms / low-quality AI article mills
const AI_CONTENT_FARMS = new Set([
  'articleforge.com', 'writesonic.com', 'rytr.me', 'texta.ai',
  'contentatscale.ai', 'ai-writer.com', 'simplified.com',
  'copy.ai', 'jasper.ai', 'writecream.com',
])

export const sourceCredibilityAgent: MiniAgent = {
  name: 'SourceCredibility',

  async run({ nodes, searchResults }: AgentInput): Promise<AgentOutput> {
    const sourceNodes = nodes.filter(n => n.type === 'source')
    if (!sourceNodes.length && !searchResults.length) {
      return { agentName: 'SourceCredibility', findings: [], confidence: 0.5 }
    }

    const findings: string[] = []
    const domains = [
      ...sourceNodes.map(n => n.domain || ''),
      ...searchResults.map(r => r.domain),
    ].filter(Boolean)

    let totalScore = 0
    let count = 0
    const seen = new Set<string>()

    for (const domain of domains) {
      if (seen.has(domain) || !domain) continue
      seen.add(domain)

      const score = domainCredibility(domain)
      totalScore += score
      count++

      if (AI_CONTENT_FARMS.has(domain)) {
        findings.push(`⚠️ AI content farm detected: ${domain}`)
      } else if (score >= 0.85) {
        findings.push(`✓ High-credibility source: ${domain} (score: ${score.toFixed(2)})`)
      } else if (score < 0.4) {
        findings.push(`⚠️ Low-credibility source: ${domain} (score: ${score.toFixed(2)})`)
      }
    }

    const avgScore = count > 0 ? totalScore / count : 0.5
    if (!findings.length) {
      findings.push(`Sources reviewed: ${count} domains, avg credibility: ${avgScore.toFixed(2)}`)
    }

    return {
      agentName:  'SourceCredibility',
      findings,
      confidence: avgScore,
      verdict:    avgScore >= 0.7 ? 'HIGH_CREDIBILITY' : avgScore >= 0.45 ? 'MIXED' : 'LOW_CREDIBILITY',
    }
  },
}
