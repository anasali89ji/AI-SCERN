// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Stylometric consistency / Voice Diversity Index
// Per-page authorial "fingerprint" (sentence length, TTR, hapax rate, function
// words, punctuation) + a site-wide diversity measure. Low diversity across
// many pages = single-source generation (AI/template), even when individual
// page AI-scores are borderline. Pure JS, zero deps, zero external calls.
// ════════════════════════════════════════════════════════════════════════════

const FUNCTION_WORDS = [
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'as', 'at', 'by', 'from', 'that', 'this', 'it', 'is', 'are', 'was', 'were',
  'be', 'been', 'have', 'has', 'had', 'not', 'so', 'if', 'than', 'then',
]

export interface StyleVector {
  meanSentenceLen:  number
  ttr:              number   // type-token ratio
  hapaxRate:        number   // fraction of words used exactly once
  functionWordFreq: number[] // frequency vector over FUNCTION_WORDS, normalised
  avgCommaPerSentence: number
  avgSemicolonPerSentence: number
}

export function extractStyleVector(text: string): StyleVector {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5)
  const words = text.toLowerCase().match(/[a-z']+/g) ?? []

  const sentLens = sentences.map(s => (s.match(/[a-z']+/gi) ?? []).length)
  const meanSentenceLen = sentLens.length > 0 ? sentLens.reduce((a, b) => a + b, 0) / sentLens.length : 0

  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  const ttr = words.length > 0 ? freq.size / words.length : 0
  const hapax = [...freq.values()].filter(c => c === 1).length
  const hapaxRate = freq.size > 0 ? hapax / freq.size : 0

  const total = words.length || 1
  const functionWordFreq = FUNCTION_WORDS.map(fw => (freq.get(fw) ?? 0) / total)

  const commas = (text.match(/,/g) ?? []).length
  const semis  = (text.match(/;/g) ?? []).length
  const avgCommaPerSentence = sentences.length > 0 ? commas / sentences.length : 0
  const avgSemicolonPerSentence = sentences.length > 0 ? semis / sentences.length : 0

  return { meanSentenceLen, ttr, hapaxRate, functionWordFreq, avgCommaPerSentence, avgSemicolonPerSentence }
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

function vectorize(v: StyleVector): number[] {
  // Normalise scalar features into comparable ranges before combining with the
  // (already 0-1) function-word frequency vector.
  return [
    Math.min(1, v.meanSentenceLen / 40),
    v.ttr,
    v.hapaxRate,
    Math.min(1, v.avgCommaPerSentence / 3),
    Math.min(1, v.avgSemicolonPerSentence),
    ...v.functionWordFreq.map(f => Math.min(1, f * 20)),
  ]
}

/**
 * Voice Diversity Index across a site's pages, 0..1.
 * 0   = every page has an near-identical stylometric fingerprint (single-source / templated / AI).
 * 1   = wide authorial variance (many distinct human voices, or naturally varied writing).
 * Computed as the mean pairwise distance between page style vectors, min-max
 * normalised against a typical human-corpus spread constant.
 */
export function voiceDiversityIndex(vectors: StyleVector[]): number {
  if (vectors.length < 2) return 1 // can't measure diversity with <2 samples — don't penalize
  const points = vectors.map(vectorize)
  let sum = 0, count = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      sum += euclidean(points[i], points[j])
      count++
    }
  }
  const meanDist = count > 0 ? sum / count : 0
  // Empirically, natural human-authored multi-author sites land ~0.9-1.6 mean
  // euclidean distance on this feature space; heavily templated/AI sites land ~0.1-0.4.
  return Math.round(Math.min(1, meanDist / 1.4) * 1000) / 1000
}
