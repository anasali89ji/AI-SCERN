/**
 * POST /api/v1/verify/document
 *
 * DocVerify™ — Verify document authenticity, AI-generated content, and originality.
 * Parses PDF/DOCX/PPTX natively, then runs the same text + image detection
 * pipelines used elsewhere in the platform, plus local plagiarism analysis.
 *
 * Input:  multipart/form-data with "file" field (application/pdf, .docx, .pptx, max 25MB)
 * Output: VerificationResponse with TrustScore + evidence
 *
 * Requires:  X-API-Key header
 * Rate limit: 60 req/min per IP
 *
 * This is the first Phase 2 module (per TRUST_PLATFORM_ARCHITECTURE.md §0) —
 * buildDocumentTrustScore() and the document_verifications schema were
 * already in place; this route is what wires them to the real
 * parseDocument -> analyzeText/analyzeImage -> computeCompositeVerdict
 * pipeline instead of leaving DocVerify™ unrouted.
 */

import { NextRequest, NextResponse }    from 'next/server'
import { parseDocument, DocumentParseError } from '@/lib/document/parser'
import { analyzeText, analyzeImage }    from '@/lib/inference/hf-analyze'
import { preprocessImage }              from '@/lib/inference/preprocess-image'
import { analyzePlagiarism }            from '@/lib/inference/plagiarism-analyzer'
import { computeCompositeVerdict, buildCompositeSummary } from '@/lib/verdict/document-composite'
import type { TextAnalysisResult, ImageAnalysisResult }   from '@/lib/verdict/document-composite'
import { checkRateLimitRedis }          from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'
import { buildDocumentTrustScore }      from '@/lib/trust/score'
import {
  createVerification, completeVerification,
  buildVerificationResponse, hashContent, generateRecommendations,
} from '@/lib/trust/verify'
import {
  auditVerificationCreated, auditVerificationCompleted, logApiAccess,
} from '@/lib/trust/audit'
import { getSupabaseAdmin }             from '@/lib/supabase/admin'
import type { EvidenceItem, Finding }   from '@/lib/trust/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 90 // matches detect/document's budget — parsing + text + image analysis

const MAX_DOC_SIZE = 25 * 1024 * 1024 // 25MB, matches /api/detect/document
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const ALLOWED_EXT = ['.pdf', '.docx', '.pptx']

const MIN_TEXT_CHARS = 50
const MAX_TEXT_CHARS = 50_000
const MAX_IMAGES_ANALYZED = 3

/** Tiny concurrency limiter — same approach as /api/detect/document, avoids a new dependency. */
function createLimiter(max: number) {
  let active = 0
  const queue: (() => void)[] = []
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            const next = queue.shift()
            if (next) next()
          })
      }
      if (active < max) run()
      else queue.push(run)
    })
  }
}

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey  = extractApiKey(req)
  if (!apiKey)  return missingKeyResponse()

  const resolved = await resolveApiKey(apiKey)
  if (!resolved.valid) return invalidOrExhaustedKeyResponse(apiKey)

  // ── Rate limit ────────────────────────────────────────────────────────────
  const allowed = await checkRateLimitRedis(`api:${ip}`, 60, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests/minute per IP.' },
      { status: 429 },
    )
  }

  // ── Parse multipart ───────────────────────────────────────────────────────
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Body must be multipart/form-data with a "file" field.' },
      { status: 400 },
    )
  }

  let file: File | null
  try {
    const form = await req.formData()
    file = form.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: '"file" field required.' }, { status: 400 })

  const nameLower = file.name.toLowerCase()
  const hasAllowedExt = ALLOWED_EXT.some(ext => nameLower.endsWith(ext))
  if (!ALLOWED_MIMES.has(file.type) && !hasAllowedExt) {
    return NextResponse.json(
      { error: 'Only PDF, DOCX, and PPTX files are supported.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_DOC_SIZE) {
    return NextResponse.json({ error: 'Document must be under 25MB.' }, { status: 400 })
  }

  const buffer   = Buffer.from(await file.arrayBuffer())
  const fileHash = await hashContent(buffer)

  // ── Register verification ─────────────────────────────────────────────────
  const verificationId = await createVerification({
    userId:         resolved.owner,
    module:         'document',
    entityType:     'file',
    entityRef:      file.name,
    entityHash:     fileHash,
    entitySizeBytes: file.size,
    apiKeyHash:     resolved.keyHash,
    metadata:       { filename: file.name, mime: file.type, size: file.size },
  })

  const scanId = verificationId ?? crypto.randomUUID()

  if (verificationId) {
    auditVerificationCreated({
      actorId:        resolved.owner,
      verificationId,
      module:         'document',
      actorIp:        ip,
    })
  }

  // ── Parse document — extract text + embedded images natively ───────────────
  let parsed: Awaited<ReturnType<typeof parseDocument>>
  try {
    parsed = await parseDocument(buffer, file.name, file.type || '')
  } catch (err) {
    const message = err instanceof DocumentParseError ? err.message : 'Failed to parse document.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const trimmedText   = parsed.text.replace(/\r/g, '')
  const hasText        = trimmedText.length >= MIN_TEXT_CHARS
  const analyzedText   = trimmedText.length > MAX_TEXT_CHARS ? trimmedText.slice(0, MAX_TEXT_CHARS) : trimmedText
  const imagesToAnalyze = parsed.images.slice(0, MAX_IMAGES_ANALYZED)
  const hasImages       = imagesToAnalyze.length > 0

  // ── Run text + image detection concurrently — same pipelines the standalone routes use ──
  const limit = createLimiter(3)

  let textAnalysis: TextAnalysisResult | null = null
  let imageAnalyses: ImageAnalysisResult[] = []

  try {
    const textAnalysisPromise: Promise<TextAnalysisResult | null> = hasText
      ? analyzeText(analyzedText)
          .then((result): TextAnalysisResult => ({
            status: 'ok',
            verdict: result.verdict,
            confidence: Math.round(result.confidence * 100),
            summary: result.summary,
            signals: result.signals,
            sentence_scores: result.sentence_scores,
          }))
          .catch((): TextAnalysisResult => ({
            status: 'error', verdict: 'UNCERTAIN', confidence: 0, summary: 'Text analysis failed',
          }))
      : Promise.resolve(null)

    const imageAnalysesPromise: Promise<ImageAnalysisResult[]> = hasImages
      ? Promise.all(
          imagesToAnalyze.map((img, idx) =>
            limit(async (): Promise<ImageAnalysisResult> => {
              try {
                const pre    = await preprocessImage(img.buffer, img.mimeType)
                const result = await analyzeImage(pre.buffer, pre.mimeType, `doc-image-${idx}`)
                return {
                  index: idx, status: 'ok', verdict: result.verdict,
                  confidence: Math.round(result.confidence * 100), summary: result.summary, signals: result.signals,
                }
              } catch {
                return { index: idx, status: 'error', verdict: 'UNCERTAIN', confidence: 0, summary: 'Image analysis failed' }
              }
            })
          )
        )
      : Promise.resolve([])

    ;[textAnalysis, imageAnalyses] = await Promise.all([textAnalysisPromise, imageAnalysesPromise])
  } catch (err) {
    console.error('[verify/document] analysis failed:', err)
    return NextResponse.json({ error: 'Document analysis failed. Please try again.' }, { status: 500 })
  }

  // ── Local plagiarism / originality analysis ─────────────────────────────────
  const plagiarismAnalysis = hasText ? analyzePlagiarism(analyzedText, parsed.paragraphs) : null

  // ── Composite verdict (same logic as /api/detect/document) ──────────────────
  const compositeInput = { textAnalysis, imageAnalyses, plagiarismAnalysis, hasText, hasImages }
  const compositeVerdict  = computeCompositeVerdict(compositeInput)
  const compositeSummary  = buildCompositeSummary(compositeInput)

  // ── Map pipeline output → trust-score inputs ────────────────────────────────
  const textAiScore   = textAnalysis?.status === 'ok'
    ? (textAnalysis.verdict === 'AI' ? textAnalysis.confidence : textAnalysis.verdict === 'UNCERTAIN' ? 50 : 100 - textAnalysis.confidence)
    : 0
  const imageAiScores = imageAnalyses
    .filter(i => i.status === 'ok')
    .map(i => i.verdict === 'AI' ? i.confidence : i.verdict === 'UNCERTAIN' ? 50 : 100 - i.confidence)
  const aiManipulationScore = Math.round(
    hasText && imageAiScores.length > 0 ? (textAiScore + Math.max(...imageAiScores)) / 2
    : hasText ? textAiScore
    : imageAiScores.length > 0 ? Math.max(...imageAiScores)
    : 0,
  )

  const ocrConfidence = hasText ? Math.min(95, 60 + Math.round(trimmedText.length / 500)) : 40
  const formatScore    = compositeVerdict === 'FLAGGED' ? 45 : compositeVerdict === 'NO_CONTENT' ? 50 : 85
  const crossRefPassed = null // Phase 3: external DB checks not wired yet

  // ── Build evidence ────────────────────────────────────────────────────────
  const evidence: EvidenceItem[] = []

  if (textAnalysis?.status === 'ok') {
    evidence.push({
      type:       'ai_detection',
      finding:    textAnalysis.verdict === 'AI'
        ? `Document text shows strong AI-generation signals (${textAnalysis.confidence}% confidence).`
        : textAnalysis.verdict === 'HUMAN'
        ? `Document text appears human-written (${textAnalysis.confidence}% confidence).`
        : `Inconclusive text analysis — mixed signals from ensemble classifiers.`,
      confidence: textAnalysis.confidence,
      severity:   textAnalysis.verdict === 'AI' ? (textAnalysis.confidence > 70 ? 'high' : 'medium') : 'none',
      details:    { verdict: textAnalysis.verdict, summary: textAnalysis.summary, signals: textAnalysis.signals?.slice?.(0, 5) },
      source:     'text-ensemble',
    })
  }

  if (imageAnalyses.length > 0) {
    const aiImages = imageAnalyses.filter(i => i.status === 'ok' && i.verdict === 'AI')
    evidence.push({
      type:       'ai_detection',
      finding:    aiImages.length > 0
        ? `${aiImages.length} of ${imageAnalyses.length} embedded image(s) flagged as likely AI-generated.`
        : `${imageAnalyses.length} embedded image(s) analyzed — no AI-generation signals found.`,
      confidence: Math.round(imageAnalyses.reduce((s, i) => s + i.confidence, 0) / imageAnalyses.length),
      severity:   aiImages.length > 0 ? 'medium' : 'none',
      details:    { images_analyzed: imageAnalyses.length, ai_flagged: aiImages.length, partial: parsed.images.length > MAX_IMAGES_ANALYZED },
      source:     'image-ensemble',
    })
  }

  if (plagiarismAnalysis) {
    evidence.push({
      type:       'plagiarism',
      finding:    `Originality check: ${plagiarismAnalysis.risk_level} risk. ${plagiarismAnalysis.summary}`,
      confidence: 60,
      severity:   plagiarismAnalysis.risk_level === 'HIGH' ? 'high' : plagiarismAnalysis.risk_level === 'MODERATE' ? 'medium' : 'none',
      details:    { risk_score: plagiarismAnalysis.risk_score, note: plagiarismAnalysis.note, signals: plagiarismAnalysis.signals },
      source:     'internal-plagiarism',
    })
  }

  evidence.push({
    type:       'document_format',
    finding:    `Document type: ${parsed.documentType}. ${parsed.pageCount || 1} unit(s) parsed natively.`,
    confidence: 50,
    severity:   'none',
    details:    { document_type: parsed.documentType, units: parsed.pageCount || 1, has_text: hasText, image_count: parsed.images.length },
    source:     'internal',
  })

  // ── Build findings ────────────────────────────────────────────────────────
  const findings: Finding[] = []
  if (compositeVerdict === 'FLAGGED') {
    findings.push({
      severity:    aiManipulationScore > 70 ? 'high' : 'medium',
      category:    'authenticity',
      message:     `Document flagged: ${compositeSummary}`,
      evidence_ref: 'evidence[0]',
    })
  } else if (compositeVerdict === 'CLEAN') {
    findings.push({
      severity:    'none',
      category:    'authenticity',
      message:     'No significant AI-generation, manipulation, or originality concerns found.',
      evidence_ref: 'evidence[0]',
    })
  } else {
    findings.push({
      severity:    'low',
      category:    'authenticity',
      message:     'No analyzable text or images found in this document.',
    })
  }

  // ── Trust score ───────────────────────────────────────────────────────────
  const scores = buildDocumentTrustScore({
    formatScore,
    aiManipulationScore,
    ocrConfidence,
    crossRefPassed,
    evidence,
  })

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = generateRecommendations({
    trustOverall: scores.trust.overall,
    riskOverall:  scores.risk.overall,
    module:       'document',
    flags: {
      highAiProb:  aiManipulationScore > 70,
      plagiarism:  plagiarismAnalysis?.risk_level === 'HIGH',
    },
  })

  const processingMs = Date.now() - startMs

  // ── Persist document-specific record ────────────────────────────────────────
  if (verificationId) {
    try {
      const sb = getSupabaseAdmin()
      await sb.from('document_verifications').insert({
        verification_id:        verificationId,
        document_type:          parsed.documentType,
        format_integrity_score: formatScore,
        ocr_text_extracted:     hasText ? analyzedText.slice(0, 5000) : null,
        ocr_confidence:         ocrConfidence,
        ai_manipulation_score:  aiManipulationScore,
        cross_reference_passed: crossRefPassed,
      })
    } catch { /* non-fatal */ }

    await completeVerification({ verificationId, scores, evidence, processingMs })
    auditVerificationCompleted({
      actorId:      resolved.owner,
      verificationId,
      module:       'document',
      trustOverall: scores.trust.overall,
      riskOverall:  scores.risk.overall,
      actorIp:      ip,
    })
  }

  recordApiUsage(resolved)
  logApiAccess({
    apiKeyHash:     resolved.keyHash,
    userId:         resolved.owner,
    actorIp:        ip,
    method:         'POST',
    path:           '/api/v1/verify/document',
    statusCode:     200,
    processingMs,
    requestSize:    file.size,
    verificationId: verificationId ?? undefined,
    module:         'document',
  })

  // ── Respond ───────────────────────────────────────────────────────────────
  const response = buildVerificationResponse({
    scanId,
    verificationId: verificationId ?? scanId,
    tool:            'DocVerify™',
    entityType:      'file',
    scores,
    evidence,
    findings,
    recommendations,
    processingMs,
  })

  return NextResponse.json(response)
}
