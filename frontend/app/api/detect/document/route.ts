import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitDB } from '@/lib/ratelimit-db'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createPresignedUpload, r2Available } from '@/lib/storage/r2'
import { nanoid } from 'nanoid'
import { parseDocument, DocumentParseError } from '@/lib/document/parser'
import { analyzeText, analyzeImage } from '@/lib/inference/hf-analyze'
import { preprocessImage } from '@/lib/inference/preprocess-image'
import { analyzePlagiarism } from '@/lib/inference/plagiarism-analyzer'
import { computeCompositeVerdict, buildCompositeSummary } from '@/lib/verdict/document-composite'
import type { TextAnalysisResult, ImageAnalysisResult } from '@/lib/verdict/document-composite'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_DOC_SIZE = 25 * 1024 * 1024 // 25MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const ALLOWED_EXT = ['.pdf', '.docx', '.pptx']

const MIN_TEXT_CHARS = 50
const MAX_TEXT_CHARS = 50_000
const MAX_IMAGES_ANALYZED = 3
const MAX_CONCURRENT_IMAGE_ANALYSES = 3
const TOTAL_BUDGET_MS = 55_000

/** Tiny concurrency limiter -- avoids pulling in an extra dependency for a 3-line need. */
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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimitDB('document', ip)
  if (rl.limited) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again in a minute.' } },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(rl.reset) } }
    )
  }

  let userId: string
  try {
    const guard = await creditGuard(req, 'document')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication required' } }, { status: 401 })
  }

  const start = Date.now()
  const deadline = start + TOTAL_BUDGET_MS

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    }

    const nameLower = file.name.toLowerCase()
    const hasAllowedExt = ALLOWED_EXT.some(ext => nameLower.endsWith(ext))
    if (!ALLOWED_MIMES.has(file.type) && !hasAllowedExt) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TYPE', message: 'Only PDF, DOCX, and PPTX files are supported' },
      }, { status: 400 })
    }
    if (file.size > MAX_DOC_SIZE) {
      return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Document must be under 25MB' } }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const bodyBytes = new Uint8Array(buffer)

    // R2 upload of the original document -- fire-and-forget, non-fatal.
    const uploadPromise = (async () => {
      if (!r2Available()) return null
      try {
        const presigned = await createPresignedUpload('document', file.name, file.type || 'application/octet-stream', userId, file.size)
        const putRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: bodyBytes,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        })
        if (!putRes.ok) {
          console.warn('[detect/document] R2 PUT returned non-ok status:', putRes.status)
          return null
        }
        return presigned.key
      } catch (e) {
        console.warn('[detect/document] R2 upload failed (non-fatal):', e)
        return null
      }
    })()

    // 1. Parse the document -- extract text + embedded images natively.
    let parsed
    try {
      parsed = await parseDocument(buffer, file.name, file.type || '')
    } catch (e) {
      const message = e instanceof DocumentParseError ? e.message : 'Failed to parse document'
      return NextResponse.json({
        success: false,
        error: { code: 'PARSE_FAILED', message },
      }, { status: 400 })
    }

    const trimmedText = parsed.text.replace(/\r/g, '')
    const hasText = trimmedText.length >= MIN_TEXT_CHARS
    const analyzedText = trimmedText.length > MAX_TEXT_CHARS ? trimmedText.slice(0, MAX_TEXT_CHARS) : trimmedText

    const imagesToAnalyze = parsed.images.slice(0, MAX_IMAGES_ANALYZED)
    const partialImageAnalysis = parsed.images.length > MAX_IMAGES_ANALYZED
    const hasImages = imagesToAnalyze.length > 0

    // 2. Run text + image detection concurrently -- same pipelines the standalone routes use.
    const limit = createLimiter(MAX_CONCURRENT_IMAGE_ANALYSES)

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
          .catch((e): TextAnalysisResult => {
            console.error('[detect/document] analyzeText failed:', e)
            return { status: 'error', verdict: 'UNCERTAIN', confidence: 0, summary: 'Text analysis failed' }
          })
      : Promise.resolve(null)

    const imageAnalysesPromise: Promise<ImageAnalysisResult[]> = hasImages
      ? Promise.all(
          imagesToAnalyze.map((img, idx) =>
            limit(async (): Promise<ImageAnalysisResult> => {
              try {
                const pre = await preprocessImage(img.buffer, img.mimeType)
                const result = await analyzeImage(pre.buffer, pre.mimeType, `doc-image-${idx}`)
                return {
                  index: idx,
                  status: 'ok',
                  verdict: result.verdict,
                  confidence: Math.round(result.confidence * 100),
                  summary: result.summary,
                  signals: result.signals,
                }
              } catch (e) {
                console.error(`[detect/document] analyzeImage failed for image ${idx}:`, e)
                return { index: idx, status: 'error', verdict: 'UNCERTAIN', confidence: 0, summary: 'Image analysis failed' }
              }
            })
          )
        )
      : Promise.resolve([])

    const remainingBudget = deadline - Date.now()
    if (remainingBudget <= 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'TIMEOUT', message: 'Analysis took too long -- try a smaller document.' },
      }, { status: 504 })
    }

    const timeoutPromise = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), remainingBudget))
    const raceResult = await Promise.race([
      Promise.all([textAnalysisPromise, imageAnalysesPromise]),
      timeoutPromise,
    ])

    if (raceResult === 'timeout') {
      return NextResponse.json({
        success: false,
        error: { code: 'TIMEOUT', message: 'Analysis took too long -- try a smaller document.' },
      }, { status: 504 })
    }

    const [textAnalysis, imageAnalyses] = raceResult

    // 3. Local plagiarism / originality analysis.
    const plagiarismAnalysis = hasText ? analyzePlagiarism(analyzedText, parsed.paragraphs) : null

    // 4. Composite verdict.
    const compositeInput = {
      textAnalysis,
      imageAnalyses,
      plagiarismAnalysis,
      hasText,
      hasImages,
    }
    const compositeVerdict = computeCompositeVerdict(compositeInput)
    const compositeSummary = buildCompositeSummary(compositeInput)

    const r2Key = await uploadPromise
    const processingTime = Date.now() - start

    // 5. Scan log -- non-fatal on failure.
    try {
      await getSupabaseAdmin().from('scans').insert({
        user_id: userId,
        media_type: 'document',
        file_name: file.name,
        file_size: file.size,
        r2_key: r2Key,
        verdict: compositeVerdict,
        confidence_score: null,
        processing_time: processingTime,
        status: 'complete',
        metadata: {
          document_type: parsed.documentType,
          units_analyzed: parsed.pageCount || 1,
          image_count: parsed.images.length,
          has_text: hasText,
          plagiarism_risk: plagiarismAnalysis?.risk_level ?? null,
          text_verdict: textAnalysis?.verdict ?? null,
          ai_images_found: imageAnalyses.filter(i => i.verdict === 'AI').length,
          partial_image_analysis: partialImageAnalysis,
        },
      })
    } catch (e) {
      console.warn('[detect/document] scan log failed (non-fatal):', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        document_type: parsed.documentType,
        units_analyzed: parsed.pageCount || 1,
        has_text: hasText,
        has_images: hasImages,
        image_count: parsed.images.length,
        text_analysis: textAnalysis,
        image_analyses: imageAnalyses,
        plagiarism_analysis: plagiarismAnalysis,
        composite_verdict: compositeVerdict,
        composite_summary: compositeSummary,
        processing_time_ms: processingTime,
        partial_analysis: partialImageAnalysis,
        r2_key: r2Key,
        scan_id: nanoid(10),
      },
    })
  } catch (err: any) {
    console.error('[detect/document]', err)
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    return NextResponse.json({
      success: false,
      error: {
        code: isTimeout ? 'TIMEOUT' : 'ANALYSIS_FAILED',
        message: isTimeout ? 'Analysis took too long -- try a smaller document.' : (err?.message || 'Analysis failed'),
      },
    }, { status: isTimeout ? 504 : 500 })
  }
}
