// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Stylometric Analysis Engine
// Voice Diversity Index, sentence patterns, lexical analysis
// Zero API calls — pure statistical computation
// ════════════════════════════════════════════════════════════════════════════

import type { StylometryResult } from './types'

const FUNCTION_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','must',
  'can','shall','this','that','these','those','i','you','he','she','it','we',
  'they','me','him','her','us','them','my','your','his','its','our','their',
])

export function analyzeStylometry(text: string): StylometryResult {
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 3)

  if (sentences.length < 2) {
    return {
      meanSentenceLength: 0,
      typeTokenRatio: 0,
      hapaxLegomenaRate: 0,
      functionWordFreq: {},
      punctuationPattern: '',
      sentenceLengthCV: 0,
      lexicalDiversity: 0,
    }
  }

  // Sentence lengths
  const sLengths = sentences.map(s => s.split(/\s+/).length)
  const meanSentenceLength = sLengths.reduce((a, b) => a + b, 0) / sLengths.length
  const sMean = meanSentenceLength
  const sVariance = sLengths.reduce((a, b) => a + Math.pow(b - sMean, 2), 0) / sLengths.length
  const sentenceLengthCV = sMean > 0 ? Math.sqrt(sVariance) / sMean : 0

  // Word-level analysis
  const words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) || []
  const uniqueWords = new Set(words)
  const typeTokenRatio = words.length > 0 ? uniqueWords.size / words.length : 0

  // Hapax legomena (words that appear exactly once)
  const wordFreq: Record<string, number> = {}
  for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1
  const hapaxCount = Object.values(wordFreq).filter(c => c === 1).length
  const hapaxLegomenaRate = words.length > 0 ? hapaxCount / words.length : 0

  // Function word frequencies
  const functionWordFreq: Record<string, number> = {}
  for (const w of words) {
    if (FUNCTION_WORDS.has(w)) {
      functionWordFreq[w] = (functionWordFreq[w] || 0) + 1
    }
  }
  // Normalize to per-1000 words
  for (const k of Object.keys(functionWordFreq)) {
    functionWordFreq[k] = Math.round((functionWordFreq[k] / words.length) * 1000 * 100) / 100
  }

  // Punctuation pattern (as a simple signature)
  const puncts = text.match(/[.!?,:;—-]/g) || []
  const totalPunct = puncts.length
  const punctPattern = totalPunct > 0
    ? `C:${((puncts.filter(p => p === ',').length / totalPunct) * 100).toFixed(0)}% S:${((puncts.filter(p => p === ';').length / totalPunct) * 100).toFixed(0)}% E:${((puncts.filter(p => p === '—' || p === '-').length / totalPunct) * 100).toFixed(0)}%`
    : 'none'

  // Lexical diversity (more sophisticated than TTR)
  // Use MTLD-like approximation: average tokens per type until TTR drops below 0.72
  let lexicalDiversity = 0
  if (words.length >= 10) {
    const windowSize = Math.min(50, Math.floor(words.length / 3))
    let totalWindows = 0
    let diversitySum = 0
    for (let i = 0; i <= words.length - windowSize; i += Math.max(1, Math.floor(windowSize / 2))) {
      const window = words.slice(i, i + windowSize)
      const uniqueInWindow = new Set(window).size
      diversitySum += uniqueInWindow / window.length
      totalWindows++
    }
    lexicalDiversity = totalWindows > 0 ? diversitySum / totalWindows : 0
  }

  return {
    meanSentenceLength: Math.round(meanSentenceLength * 10) / 10,
    typeTokenRatio: Math.round(typeTokenRatio * 1000) / 1000,
    hapaxLegomenaRate: Math.round(hapaxLegomenaRate * 1000) / 1000,
    functionWordFreq,
    punctuationPattern: punctPattern,
    sentenceLengthCV: Math.round(sentenceLengthCV * 1000) / 1000,
    lexicalDiversity: Math.round(lexicalDiversity * 1000) / 1000,
  }
}

/**
 * Compute Voice Diversity Index across multiple pages
 * Low variance = single source (likely AI or template)
 * High variance = multiple authors / natural variation
 */
export function computeVoiceDiversityIndex(pages: StylometryResult[]): number {
  if (pages.length < 2) return 0.5

  const features = pages.map(p => [
    p.meanSentenceLength,
    p.typeTokenRatio * 100,
    p.hapaxLegomenaRate * 100,
    p.sentenceLengthCV * 100,
    p.lexicalDiversity * 100,
  ])

  // Compute coefficient of variation for each feature across pages
  const numFeatures = features[0].length
  const cvScores: number[] = []

  for (let f = 0; f < numFeatures; f++) {
    const values = features.map(p => p[f])
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    if (mean === 0) continue
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const cv = Math.sqrt(variance) / mean
    cvScores.push(cv)
  }

  // Average CV across features
  const avgCV = cvScores.reduce((a, b) => a + b, 0) / cvScores.length

  // Normalize: typical human multi-author sites have CV > 0.25
  // Single-source AI/template sites have CV < 0.12
  const diversityIndex = Math.min(1, Math.max(0, avgCV * 3))

  return Math.round(diversityIndex * 1000) / 1000
}

/**
 * Detect stylometric consistency flag
 * Returns true if the writing style is suspiciously uniform
 */
export function detectStylometricFlag(pages: StylometryResult[]): boolean {
  const diversity = computeVoiceDiversityIndex(pages)
  return diversity < 0.15 && pages.length >= 3
}
