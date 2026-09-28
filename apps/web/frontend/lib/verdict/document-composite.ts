import type { PlagiarismAnalysis } from '@/lib/inference/plagiarism-analyzer'

export interface TextAnalysisResult {
  status: 'ok' | 'error'
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number
  summary?: string
  signals?: any[]
  sentence_scores?: any[]
}

export interface ImageAnalysisResult {
  index: number
  status: 'ok' | 'error'
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number
  summary?: string
  signals?: any[]
}

export interface CompositeInput {
  textAnalysis: TextAnalysisResult | null
  imageAnalyses: ImageAnalysisResult[]
  plagiarismAnalysis: PlagiarismAnalysis | null
  hasText: boolean
  hasImages: boolean
}

export type CompositeVerdict = 'CLEAN' | 'FLAGGED' | 'NO_CONTENT'

export function computeCompositeVerdict(input: CompositeInput): CompositeVerdict {
  if (!input.hasText && !input.hasImages) return 'NO_CONTENT'

  const textIsAi = input.textAnalysis?.status === 'ok' && input.textAnalysis.verdict === 'AI'
  const anyImageIsAi = input.imageAnalyses.some(i => i.status === 'ok' && i.verdict === 'AI')
  if (textIsAi || anyImageIsAi) return 'FLAGGED'

  const textIsUncertain = input.textAnalysis?.status === 'ok' && input.textAnalysis.verdict === 'UNCERTAIN'
  const anyImageIsUncertain = input.imageAnalyses.some(i => i.status === 'ok' && i.verdict === 'UNCERTAIN')
  if (textIsUncertain || anyImageIsUncertain) return 'FLAGGED'

  if (input.plagiarismAnalysis?.risk_level === 'HIGH') return 'FLAGGED'

  return 'CLEAN'
}

export function buildCompositeSummary(input: CompositeInput): string {
  const parts: string[] = []
  if (input.textAnalysis) {
    parts.push(`Text: ${input.textAnalysis.verdict} (${input.textAnalysis.confidence}%)`)
  }
  if (input.imageAnalyses.length > 0) {
    const aiImages = input.imageAnalyses.filter(i => i.verdict === 'AI').length
    const total = input.imageAnalyses.length
    parts.push(`Images: ${aiImages}/${total} flagged as AI`)
  }
  if (input.plagiarismAnalysis) {
    parts.push(`Originality: ${input.plagiarismAnalysis.risk_level} risk`)
  }
  return parts.join(' \u00b7 ') || 'No analyzable content found in document.'
}
