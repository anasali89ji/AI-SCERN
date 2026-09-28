// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Lightweight Perplexity Burst Engine
// Uses character-level n-gram model built from the text itself
// Detects unnaturally even perplexity (AI signature)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Build a character-level n-gram model from reference text
 * Returns a map of n-gram -> probability
 */
function buildNgramModel(text: string, n: number = 4): Map<string, number> {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s.,!?;:\-]/g, '')
  const counts = new Map<string, number>()
  const total = cleaned.length - n + 1

  for (let i = 0; i <= cleaned.length - n; i++) {
    const gram = cleaned.slice(i, i + n)
    counts.set(gram, (counts.get(gram) || 0) + 1)
  }

  // Convert to probabilities
  const probs = new Map<string, number>()
  for (const [gram, count] of counts) {
    probs.set(gram, count / total)
  }

  return probs
}

/**
 * Compute perplexity of a text segment against an n-gram model
 * Lower perplexity = more predictable = more likely AI
 */
function computePerplexity(text: string, model: Map<string, number>, n: number = 4): number {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s.,!?;:\-]/g, '')
  if (cleaned.length < n + 5) return 100 // not enough data

  let logProbSum = 0
  let count = 0
  const smoothing = 0.0001

  for (let i = 0; i <= cleaned.length - n; i++) {
    const gram = cleaned.slice(i, i + n)
    const prob = model.get(gram) || smoothing
    logProbSum += Math.log2(prob)
    count++
  }

  if (count === 0) return 100
  const avgLogProb = logProbSum / count
  const perplexity = Math.pow(2, -avgLogProb)

  return Math.min(1000, perplexity)
}

/**
 * Compute perplexity burst score for a text
 * AI text typically has low, unnaturally even perplexity across sentences
 * Human text has high variance in perplexity
 * 
 * Returns score 0-1 where higher = more AI-like (low, even perplexity)
 */
export function computePerplexityBurst(text: string): { score: number; sentencePerplexities: number[]; burstiness: number } {
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.split(/\s+/).length >= 4)
    .slice(0, 50)

  if (sentences.length < 3) {
    return { score: 0.5, sentencePerplexities: [], burstiness: 0 }
  }

  // Build model from full text
  const model = buildNgramModel(text, 4)

  // Compute per-sentence perplexity
  const perps: number[] = []
  for (const sentence of sentences) {
    const p = computePerplexity(sentence, model, 4)
    perps.push(p)
  }

  // Normalize perplexities to 0-1 range (lower = more predictable)
  // Typical range: 10-200 for natural text, 5-50 for AI text
  const normalized = perps.map(p => {
    if (p < 15) return 0.9
    if (p < 30) return 0.7
    if (p < 60) return 0.5
    if (p < 100) return 0.3
    return 0.1
  })

  // Burstiness: variance of normalized perplexities
  // AI: low burstiness (all sentences similarly predictable)
  // Human: high burstiness (some complex, some simple)
  const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length
  const variance = normalized.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / normalized.length
  const burstiness = Math.sqrt(variance)

  // AI signature: low mean perplexity + low burstiness
  const meanScore = mean // 0-1, higher = more AI-like
  const burstScore = burstiness < 0.08 ? 0.9 : burstiness < 0.15 ? 0.7 : burstiness < 0.25 ? 0.4 : 0.15

  // Combined: weight mean more, but penalize high burstiness
  const score = Math.min(0.98, meanScore * 0.6 + burstScore * 0.4)

  return {
    score: Math.round(score * 1000) / 1000,
    sentencePerplexities: perps.map(p => Math.round(p * 10) / 10),
    burstiness: Math.round(burstiness * 1000) / 1000,
  }
}

/**
 * Compute information density curve
 * Counts named entities, numbers, and novel claims per paragraph
 * AI text often plateaus early (repetitive information)
 */
export function computeInformationDensity(text: string): number {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 40)
  if (paragraphs.length < 3) return 0.5

  const densities: number[] = []

  for (const para of paragraphs.slice(0, 20)) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length < 10) continue

    // Named entities (capitalized words that aren't sentence-start)
    const entities = (para.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [])
      .filter(e => e.length > 2)
      .length

    // Numbers
    const numbers = (para.match(/\b\d+(?:\.\d+)?(?:%|\s*(?:million|billion|thousand))?\b/gi) || []).length

    // Novel claims (indicators of new information)
    const claims = (para.match(/\b(found|discovered|revealed|showed|demonstrated|proved|confirmed|reported|announced|stated)\b/gi) || []).length

    const density = (entities + numbers * 0.5 + claims) / words.length
    densities.push(density)
  }

  if (densities.length < 3) return 0.5

  // AI signature: density plateaus or decreases after first few paragraphs
  const firstHalf = densities.slice(0, Math.ceil(densities.length / 2))
  const secondHalf = densities.slice(Math.floor(densities.length / 2))

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  // If second half is significantly lower, it's an AI plateau pattern
  const plateauRatio = firstAvg > 0 ? secondAvg / firstAvg : 1

  // Score: lower plateau ratio = more AI-like
  const score = plateauRatio < 0.4 ? 0.85 : plateauRatio < 0.6 ? 0.65 : plateauRatio < 0.8 ? 0.45 : 0.25

  return Math.round(score * 1000) / 1000
}
