import knowledgeBase from './aria-knowledge.json'

export interface RagContext {
  domain: string
  confidence: number
  response: string
  sources: string[]
}

const DOMAINS = knowledgeBase.domains
const FALLBACKS = knowledgeBase.fallbacks

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function scoreDomain(query: string, domain: typeof DOMAINS[0]): number {
  const tokens = tokenize(query)
  const keywords = domain.keywords
  let hits = 0
  for (const token of tokens) {
    for (const kw of keywords) {
      if (kw.includes(token) || token.includes(kw)) hits++
    }
  }
  return hits / Math.max(tokens.length, 1)
}

export function queryAriaRag(userQuery: string): RagContext {
  const scores = DOMAINS.map(d => ({
    domain: d,
    score: scoreDomain(userQuery, d),
  })).sort((a, b) => b.score - a.score)

  const best = scores[0]

  if (best.score > 0.15) {
    const responses = best.domain.responses
    const pick = responses[Math.floor(Math.random() * responses.length)]
    return {
      domain: best.domain.id,
      confidence: Math.min(best.score * 2.5, 0.95),
      response: pick,
      sources: [`aria-knowledge:${best.domain.id}`],
    }
  }

  return {
    domain: 'general',
    confidence: 0.3,
    response: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)],
    sources: ['aria-knowledge:fallback'],
  }
}

export function buildSystemPrompt(rag: RagContext): string {
  return `You are ARIA (Attestation & Robust Intelligence Assistant), the AI forensics expert for AI-SCERN.
Current context: ${rag.domain} (confidence: ${(rag.confidence * 100).toFixed(0)}%).
Knowledge base says: "${rag.response}"

Guidelines:
- Be concise but technically precise.
- If the user provides media, describe what forensic indicators you would examine.
- Never make up detection results; always guide users to the actual detection tools.
- Use markdown formatting for readability.`
}
