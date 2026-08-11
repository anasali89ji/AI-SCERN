export interface PlagiarismAnalysis {
  status: 'ok'
  risk_score: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH'
  summary: string
  note: string
  signals: {
    duplicated_snippet_examples?: string[]
    lexical_diversity_score: number
    boilerplate_count: number
    repetition_flags: string[]
  }
}

const BOILERPLATE_PHRASES = [
  'in conclusion',
  'it is important to note',
  'furthermore',
  "in today's world",
  'in today\u2019s society',
  'overall, it is clear',
  'this essay will discuss',
  'in this essay',
  'as previously mentioned',
  'on the other hand',
  'moreover',
  'additionally, it is worth',
]

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || [])
}

export function analyzePlagiarism(text: string, paragraphs: string[]): PlagiarismAnalysis {
  const cleanParagraphs = paragraphs.map(p => p.trim()).filter(p => p.length > 0)

  // Internal duplication — hash each paragraph, count repeats.
  const hashCounts = new Map<string, { count: number; example: string }>()
  for (const p of cleanParagraphs) {
    const key = simpleHash(p.toLowerCase().replace(/\s+/g, ' '))
    const existing = hashCounts.get(key)
    if (existing) existing.count += 1
    else hashCounts.set(key, { count: 1, example: p })
  }
  const duplicated = [...hashCounts.values()].filter(v => v.count > 1)
  const dupRatio = cleanParagraphs.length > 0
    ? duplicated.reduce((sum, d) => sum + d.count, 0) / cleanParagraphs.length
    : 0
  const duplicatedExamples = duplicated.slice(0, 3).map(d => d.example.slice(0, 140))

  // Lexical diversity — type-token ratio.
  const tokens = tokenize(text)
  const uniqueTokens = new Set(tokens)
  const ttr = tokens.length > 0 ? uniqueTokens.size / tokens.length : 1

  // Repetition density — sentences sharing the same opening 4 words.
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim()).filter(Boolean)
  const openerCounts = new Map<string, number>()
  for (const s of sentences) {
    const opener = tokenize(s).slice(0, 4).join(' ')
    if (!opener) continue
    openerCounts.set(opener, (openerCounts.get(opener) || 0) + 1)
  }
  const repetitionFlags = [...openerCounts.entries()]
    .filter(([, count]) => count > 3)
    .map(([opener, count]) => `"${opener}..." repeated ${count}x`)

  // Boilerplate phrase count.
  const lowerText = text.toLowerCase()
  let boilerplateCount = 0
  for (const phrase of BOILERPLATE_PHRASES) {
    const occurrences = lowerText.split(phrase).length - 1
    boilerplateCount += occurrences
  }

  // Composite score.
  let score = 0
  if (dupRatio > 0.20) score += 30
  if (dupRatio > 0.40) score += 20
  if (ttr < 0.40) score += 25
  if (ttr < 0.50) score += 10
  if (boilerplateCount > 5) score += 15
  if (boilerplateCount > 10) score += 10
  if (repetitionFlags.length > 3) score += 10
  score = Math.min(score, 100)

  const riskLevel: PlagiarismAnalysis['risk_level'] = score < 30 ? 'LOW' : score < 60 ? 'MODERATE' : 'HIGH'

  const summaryParts: string[] = []
  if (dupRatio > 0.20) summaryParts.push(`${Math.round(dupRatio * 100)}% duplicated paragraphs`)
  if (ttr < 0.50) summaryParts.push(`low lexical diversity (TTR ${ttr.toFixed(2)})`)
  if (boilerplateCount > 5) summaryParts.push(`${boilerplateCount} boilerplate phrases`)
  if (repetitionFlags.length > 3) summaryParts.push('repeated sentence openers')
  const summary = summaryParts.length > 0
    ? `Originality concerns: ${summaryParts.join(', ')}.`
    : 'No significant originality concerns detected.'

  return {
    status: 'ok',
    risk_score: score,
    risk_level: riskLevel,
    summary,
    note: 'Heuristic-based local analysis, not a substitute for a full plagiarism database check.',
    signals: {
      duplicated_snippet_examples: duplicatedExamples.length > 0 ? duplicatedExamples : undefined,
      lexical_diversity_score: Math.round(ttr * 100) / 100,
      boilerplate_count: boilerplateCount,
      repetition_flags: repetitionFlags,
    },
  }
}
