// ════════════════════════════════════════════════════════════════════════════
// AISCERN MINI-AGENT — TrendAgent
// Detects temporal signals in the query, scores source freshness,
// and prioritises recent findings over stale ones.
// ════════════════════════════════════════════════════════════════════════════

import type { MiniAgent, AgentInput, AgentOutput } from './types'

const TEMPORAL_SIGNALS = [
  'latest', 'recent', 'new', 'just', 'today', 'this week', 'this month',
  'breaking', 'just released', 'announced', 'update', 'now', 'currently',
  '2024', '2025', '2026',
]

function parseResultDate(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d.getTime()
  } catch { return null }
}

export const trendAgent: MiniAgent = {
  name: 'TrendAgent',

  async run({ query, searchResults }: AgentInput): Promise<AgentOutput> {
    const lower = query.toLowerCase()
    const temporalHits = TEMPORAL_SIGNALS.filter(sig => lower.includes(sig))
    const isTemporalQuery = temporalHits.length > 0

    const findings: string[] = []
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    // Score freshness of sources
    const datedResults = searchResults
      .map(r => ({ ...r, ts: parseResultDate(r.date) }))
      .filter(r => r.ts !== null)
      .sort((a, b) => (b.ts as number) - (a.ts as number))

    const freshCount  = datedResults.filter(r => (r.ts as number) > thirtyDaysAgo).length
    const totalDated  = datedResults.length

    if (isTemporalQuery) {
      findings.push(`⏱ Temporal query detected (signals: ${temporalHits.slice(0, 3).join(', ')})`)
      if (freshCount > 0) {
        findings.push(`✓ ${freshCount}/${totalDated} sources published within last 30 days`)
      } else if (totalDated > 0) {
        findings.push(`⚠️ No recent sources found — results may be outdated`)
      }
    }

    if (datedResults.length > 0) {
      const newest = datedResults[0]
      findings.push(`Most recent source: [${newest.domain}] "${newest.title?.slice(0, 60)}" (${newest.date})`)
    }

    const freshnessScore = totalDated > 0 ? freshCount / totalDated : 0.5
    const confidence = isTemporalQuery ? Math.max(0.3, freshnessScore) : 0.5

    return {
      agentName:  'TrendAgent',
      findings:   findings.length ? findings : ['No temporal signals in query'],
      confidence,
      verdict:    isTemporalQuery && freshCount > 0 ? 'FRESH_SOURCES' : isTemporalQuery ? 'STALE_SOURCES' : undefined,
    }
  },
}
