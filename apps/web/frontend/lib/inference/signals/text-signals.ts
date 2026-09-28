/**
 * Aiscern — Advanced Text Signal Extractors
 * Pure deterministic algorithms. No ML required — fast, always available.
 *
 * Signals:
 *  1. Perplexity Proxy       – AI text is "too smooth" (low perplexity)
 *  2. Burstiness             – human writing has bursty rare words
 *  3. Type-Token Ratio       – vocabulary richness via MATTR
 *  4. Zipf Deviation         – AI word-freq deviates from power law
 *  5. Sentence Uniformity    – AI sentences are unnaturally similar in length
 *  6. AI Phrase Fingerprint  – LLM-specific overused phrases
 *  7. Punctuation Entropy    – AI punctuation is systematic, not idiosyncratic
 *  8. Hapax Ratio            – unique once-occurring words (higher in humans)
 */

export interface TextSignalResult {
  name:        string
  score:       number   // 0–1, higher = more AI-like
  weight:      number
  description: string
}

function perplexityProxy(text: string): number {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length < 20) return 0.5
  const bigrams = new Map<string, number>()
  for (let i = 0; i < words.length - 1; i++) {
    const bg = words[i] + ' ' + words[i + 1]
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1)
  }
  const repeated = [...bigrams.values()].filter(c => c > 1).length
  const predictability = repeated / Math.max(bigrams.size, 1)
  return Math.min(0.95, Math.max(0.05, predictability * 2.5))
}

function burstinessScore(text: string): number {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 4)
  if (words.length < 30) return 0.5
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  const repeated = [...freq.entries()].filter(([, c]) => c >= 2).map(([w]) => w)
  if (!repeated.length) return 0.3
  let totalCV = 0
  for (const word of repeated.slice(0, 15)) {
    const positions = words.reduce((acc, w, i) => { if (w === word) acc.push(i); return acc }, [] as number[])
    if (positions.length < 2) continue
    const gaps    = positions.slice(1).map((p, i) => p - positions[i])
    const mean    = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const variance= gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gaps.length
    totalCV      += Math.sqrt(variance) / Math.max(mean, 1)
  }
  const avgCV = totalCV / Math.max(repeated.length, 1)
  return Math.min(0.95, Math.max(0.05, 1 - Math.min(1, avgCV / 2)))
}

function typeTokenRatio(text: string): number {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length < 10) return 0.5
  const windowSize = Math.min(50, words.length)
  let totalTTR = 0; let windows = 0
  for (let i = 0; i <= words.length - windowSize; i += Math.max(1, Math.floor(windowSize / 4))) {
    const w = words.slice(i, i + windowSize)
    totalTTR += new Set(w).size / windowSize
    windows++
  }
  const mattr = totalTTR / Math.max(windows, 1)
  if (mattr >= 0.60 && mattr <= 0.78) return 0.65
  if (mattr > 0.78) return 0.25
  return 0.40
}

function zipfDeviation(text: string): number {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length < 50) return 0.5
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  const sorted = [...freq.values()].sort((a, b) => b - a)
  const C = sorted[0]
  let deviation = 0
  for (let i = 1; i <= Math.min(sorted.length, 20); i++) {
    deviation += Math.abs(sorted[i - 1] - C / i) / Math.max(C / i, 1)
  }
  return Math.min(0.95, Math.max(0.05, Math.min(1, (deviation / Math.min(sorted.length, 20)) * 1.5)))
}

function sentenceUniformity(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().split(/\s+/).length >= 4)
  if (sentences.length < 3) return 0.5
  const lengths = sentences.map(s => s.trim().split(/\s+/).length)
  const mean    = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance= lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length
  const cv      = Math.sqrt(variance) / Math.max(mean, 1)
  if (cv < 0.20) return 0.82
  if (cv < 0.30) return 0.65
  if (cv < 0.40) return 0.45
  return 0.25
}

const AI_PHRASES = [
  'additionally','furthermore','moreover','consequently','nevertheless',
  'in conclusion','to summarize','in summary','it is worth noting',
  'it is important to note','it is crucial','it is essential',
  'as an ai','as a language model','as an artificial intelligence',
  'multifaceted','nuanced','comprehensive','leverage','paradigm',
  'in the realm of','delve into','dive into','tapestry','landscape',
  'navigate','foster','pivotal','crucial','vital','certainly!',
  'absolutely!','great question','excellent question','with that said',
  'having said that','that being said','needless to say',
]

function aiPhraseFingerprint(text: string): number {
  const lower = text.toLowerCase()
  const wordCount = Math.max(text.split(/\s+/).length, 1)
  const hits = AI_PHRASES.filter(p => lower.includes(p)).length
  return Math.min(0.95, Math.max(0.05, Math.min(1, (hits / (wordCount / 100)) * 0.35)))
}

function hapaxRatio(text: string): number {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  if (words.length < 30) return 0.5
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  const hapax = [...freq.values()].filter(c => c === 1).length / Math.max(freq.size, 1)
  if (hapax > 0.75) return 0.20
  if (hapax > 0.60) return 0.35
  if (hapax > 0.45) return 0.55
  return 0.75
}

export function extractTextSignals(text: string): TextSignalResult[] {
  return [
    { name: 'Sentence Uniformity',     score: sentenceUniformity(text),    weight: 0.22, description: 'AI sentences are unnaturally similar in length; humans vary much more' },
    { name: 'AI Phrase Fingerprint',   score: aiPhraseFingerprint(text),   weight: 0.22, description: 'LLMs overuse specific transitional phrases ("Furthermore", "Delve into")' },
    { name: 'Perplexity Proxy',        score: perplexityProxy(text),       weight: 0.14, description: 'AI text reuses predictable word pairs; human writing is less formulaic' },
    { name: 'Burstiness',              score: burstinessScore(text),       weight: 0.12, description: 'Human writers use key words in local bursts; AI distributes evenly' },
    { name: "Zipf's Law Deviation",    score: zipfDeviation(text),         weight: 0.12, description: "Natural language follows Zipf's power law; AI produces flatter distributions" },
    { name: 'Vocabulary Richness',     score: typeTokenRatio(text),        weight: 0.10, description: 'AI hits a mechanical sweetspot of variety; humans are less systematic' },
    { name: 'Hapax Legomena Ratio',    score: hapaxRatio(text),            weight: 0.08, description: 'Human writers use more unique once-occurring words than AI systems' },
  ]
}

export function aggregateTextSignals(signals: TextSignalResult[]): number {
  const totalW = signals.reduce((s, sig) => s + sig.weight, 0)
  return signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalW
}

// ── New signals from engineering brief ──────────────────────────────────────

/**
 * 9. Surprisal Diversity (DivEye approximation)
 *    Measures variance in word "surprisingness" via unigram frequency proxy.
 *    AI text has unnaturally low surprisal variance — every word is "expected".
 */
function surprisalDiversity(text: string): number {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  if (words.length < 20) return 0.5
  // Common word frequency proxy — very common words have near-zero surprisal
  const COMMON = new Set(['the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','this','that','these','those','and','or','but','in','on',
    'at','to','for','of','with','by','from','as','about','into','through','during'])
  const surprisals = words.map(w => COMMON.has(w) ? 0.05 : Math.min(1, 0.3 + w.length * 0.05))
  const mean = surprisals.reduce((a, b) => a + b, 0) / surprisals.length
  const variance = surprisals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / surprisals.length
  const stdDev = Math.sqrt(variance)
  // Low std dev = AI (uniform surprisal), high std dev = human (varied)
  if (stdDev < 0.12) return 0.80
  if (stdDev < 0.18) return 0.60
  if (stdDev < 0.25) return 0.40
  return 0.20
}

/**
 * 10. Wavelet Volatility Proxy (temporal smoothness)
 *     Approximates wavelet decomposition energy via rolling-window variance.
 *     AI text shows smooth late-stage volatility decay; humans fluctuate more.
 */
function waveletVolatilityProxy(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15)
  if (sentences.length < 4) return 0.5
  // Sentence-level "signal" = complexity proxy (avg word length)
  const signal = sentences.map(s => {
    const words = s.trim().split(/\s+/).filter(Boolean)
    return words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1)
  })
  // Rolling window variance (window=3) — captures local volatility
  const windowVars: number[] = []
  for (let i = 0; i <= signal.length - 3; i++) {
    const win  = signal.slice(i, i + 3)
    const mean = win.reduce((a, b) => a + b, 0) / 3
    const variance = win.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 3
    windowVars.push(variance)
  }
  // Compare early vs late variance — AI text becomes smoother over time
  const earlyVar = windowVars.slice(0, Math.floor(windowVars.length / 2))
  const lateVar  = windowVars.slice(Math.floor(windowVars.length / 2))
  const earlyMean = earlyVar.reduce((a, b) => a + b, 0) / Math.max(earlyVar.length, 1)
  const lateMean  = lateVar.reduce((a, b) => a + b, 0)  / Math.max(lateVar.length, 1)
  const decayRatio = lateMean / Math.max(earlyMean, 0.01)
  // Smooth decay (ratio < 0.7) signals AI; volatile = human
  if (decayRatio < 0.50) return 0.82
  if (decayRatio < 0.70) return 0.65
  if (decayRatio < 0.90) return 0.45
  return 0.25
}

/**
 * 11. Punctuation Rhythm
 *     AI punctuation is systematic (commas every N words); humans are idiosyncratic.
 *     Measures inter-punctuation interval coefficient of variation.
 */
function punctuationRhythm(text: string): number {
  const words = text.split(/\s+/)
  const intervals: number[] = []
  let gap = 0
  for (const word of words) {
    if (/[,;:]/.test(word)) { intervals.push(gap); gap = 0 } else gap++
  }
  if (intervals.length < 3) return 0.5
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const stdDev = Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length)
  const cv = stdDev / Math.max(mean, 1)
  // Low CV = mechanical rhythm = AI; high CV = human
  if (cv < 0.30) return 0.75
  if (cv < 0.55) return 0.55
  if (cv < 0.80) return 0.38
  return 0.20
}

/**
 * 12. Homoglyph Suspicion Signal
 *     Unicode homoglyphs (Cyrillic/Greek mixed with Latin) indicate
 *     adversarial evasion attempts on tokenization-based detectors.
 */
function homoglyphSuspicion(text: string): number {
  // Detect Cyrillic characters mixed with Latin
  const hasMixedScript = /[a-zA-Z]/.test(text) && /[\u0400-\u04FF\u0370-\u03FF]/.test(text)
  const invisibleChars = (text.match(/[\u200B\u200C\u200D\u00AD\uFEFF]/g) || []).length
  if (hasMixedScript) return 0.90  // Strong adversarial signal
  if (invisibleChars > 2) return 0.80
  if (invisibleChars > 0) return 0.65
  return 0.05  // Clean text → not suspicious
}

// ── Augmented export (replaces the original) ─────────────────────────────────

export function extractTextSignalsV2(text: string): TextSignalResult[] {
  const base = [
    { name: 'Sentence Uniformity',     score: sentenceUniformity(text),    weight: 0.18, description: 'AI sentences are unnaturally similar in length; humans vary much more' },
    { name: 'AI Phrase Fingerprint',   score: aiPhraseFingerprint(text),   weight: 0.18, description: 'LLMs overuse specific transitional phrases ("Furthermore", "Delve into")' },
    { name: 'Perplexity Proxy',        score: perplexityProxy(text),       weight: 0.12, description: 'AI text reuses predictable word pairs; human writing is less formulaic' },
    { name: 'Burstiness',              score: burstinessScore(text),       weight: 0.10, description: 'Human writers use key words in local bursts; AI distributes evenly' },
    { name: "Zipf's Law Deviation",    score: zipfDeviation(text),         weight: 0.10, description: "Natural language follows Zipf's power law; AI produces flatter distributions" },
    { name: 'Vocabulary Richness',     score: typeTokenRatio(text),        weight: 0.08, description: 'AI hits a mechanical sweetspot of variety; humans are less systematic' },
    { name: 'Hapax Legomena Ratio',    score: hapaxRatio(text),            weight: 0.06, description: 'Human writers use more unique once-occurring words than AI systems' },
    // New signals from engineering brief
    { name: 'Surprisal Diversity',     score: surprisalDiversity(text),    weight: 0.09, description: 'AI text has unnaturally low surprisal variance — every word is statistically expected' },
    { name: 'Temporal Volatility',     score: waveletVolatilityProxy(text),weight: 0.07, description: 'AI text grows smoother over time; human writing maintains volatile complexity' },
    { name: 'Punctuation Rhythm',      score: punctuationRhythm(text),     weight: 0.05, description: 'AI punctuation follows a mechanical interval; human punctuation is idiosyncratic' },
  ]
  // Conditionally add homoglyph signal only if suspicious (avoid noise)
  const hScore = homoglyphSuspicion(text)
  if (hScore > 0.60) {
    base.push({ name: 'Homoglyph Evasion', score: hScore, weight: 0.07, description: 'Mixed Unicode scripts detected — possible adversarial evasion of tokenization-based detectors' })
  }
  return base
}
