// ════════════════════════════════════════════════════════════════════════════
// AISCERN MINI-AGENT — ContradictionAgent
// Finds pairs of claims that contradict each other across sources.
// Uses token-level negation detection and semantic opposition heuristics.
// ════════════════════════════════════════════════════════════════════════════

import type { MiniAgent, AgentInput, AgentOutput } from './types'

const NEGATION_PAIRS: Array<[string, string]> = [
  ['is ai', 'is not ai'],
  ['is human', 'is not human'],
  ['is fake', 'is real'],
  ['is real', 'is fake'],
  ['was generated', 'was not generated'],
  ['does contain', 'does not contain'],
  ['detected', 'not detected'],
  ['confirmed', 'denied'],
  ['true', 'false'],
  ['accurate', 'inaccurate'],
  ['authentic', 'synthetic'],
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(t => t.length > 2))
}

function overlapScore(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (!ta.size || !tb.size) return 0
  return [...ta].filter(t => tb.has(t)).length / Math.max(ta.size, tb.size)
}

function detectsContradiction(textA: string, textB: string): boolean {
  const na = normalize(textA)
  const nb = normalize(textB)

  // High topic overlap + negation pairs → contradiction
  const topicOverlap = overlapScore(na, nb)
  if (topicOverlap < 0.2) return false  // not even about same topic

  for (const [pos, neg] of NEGATION_PAIRS) {
    if ((na.includes(pos) && nb.includes(neg)) ||
        (nb.includes(pos) && na.includes(neg))) {
      return true
    }
  }
  return false
}

export const contradictionAgent: MiniAgent = {
  name: 'ContradictionDetector',

  async run({ nodes }: AgentInput): Promise<AgentOutput> {
    const claimNodes = nodes.filter(n => n.type === 'claim' || n.type === 'fact')
    const findings: string[] = []
    let contradictions = 0

    // Compare every pair of claims from DIFFERENT sources
    for (let i = 0; i < claimNodes.length; i++) {
      for (let j = i + 1; j < claimNodes.length; j++) {
        const a = claimNodes[i]
        const b = claimNodes[j]
        // Only flag contradictions between different sources
        if (a.domain && b.domain && a.domain === b.domain) continue
        if (detectsContradiction(a.content, b.content)) {
          contradictions++
          const srcA = a.domain ? `[${a.domain}]` : '[source A]'
          const srcB = b.domain ? `[${b.domain}]` : '[source B]'
          findings.push(
            `⚡ Contradiction: ${srcA} "${a.content.slice(0, 80)}" ↔ ${srcB} "${b.content.slice(0, 80)}"`
          )
          if (findings.length >= 3) break  // cap at 3 contradiction pairs
        }
      }
      if (findings.length >= 3) break
    }

    if (!findings.length) {
      findings.push(`No contradictions detected across ${claimNodes.length} claims`)
    }

    const confidence = contradictions > 0 ? Math.min(0.9, 0.5 + contradictions * 0.15) : 0.7
    return {
      agentName:  'ContradictionDetector',
      findings,
      confidence,
      verdict:    contradictions > 0 ? 'CONTRADICTIONS_FOUND' : 'CONSISTENT',
    }
  },
}
