export const maxDuration = 55

import { checkRateLimitDB } from '@/lib/ratelimit-db'
import { NextRequest, NextResponse } from 'next/server'
import { analyzeText } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sanitizeDetectionResultForClient } from '@/lib/api/sanitize-response'
import { validateDocumentUpload } from '@/lib/security/fileValidation'

export const dynamic    = 'force-dynamic'

const MAX_PDF_SIZE   = 20 * 1024 * 1024   // 20MB
const CHUNK_SIZE     = 2000               // chars per chunk
const CHUNK_OVERLAP  = 200               // overlap for context
const MAX_CHUNKS     = 50                 // cap parallel work

interface ChunkResult {
  chunkIndex:  number
  startChar:   number
  endChar:     number
  text:        string
  verdict:     'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence:  number
}

/** Split text into overlapping chunks */
function chunkText(text: string, size: number, overlap: number): { text: string; start: number; end: number }[] {
  const chunks: { text: string; start: number; end: number }[] = []
  // Split on sentence boundaries when possible
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let current = ''
  let currentStart = 0
  let pos = 0

  for (const sentence of sentences) {
    if (current.length + sentence.length > size && current.length > 0) {
      chunks.push({ text: current.trim(), start: currentStart, end: currentStart + current.length })
      // Keep overlap from end of current chunk
      const overlapText = current.slice(-overlap)
      currentStart = currentStart + current.length - overlapText.length
      current = overlapText
    }
    current += sentence
    pos += sentence.length
  }
  if (current.trim().length >= 50) {
    chunks.push({ text: current.trim(), start: currentStart, end: currentStart + current.length })
  }
  return chunks
}

/** Check if a string looks like real human/AI readable text (not binary PDF structure) */
function isReadableParagraph(text: string): boolean {
  if (text.length < 80) return false
  // Reject PDF structure artifacts
  if (/^%PDF|^endobj|^xref|^startxref|^trailer/.test(text)) return false
  if (/<<\s*\/\w+|obj\s*<<|\bobj\b.*\bendobj\b/s.test(text)) return false
  // Must have mostly printable ASCII letter/digit characters
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length
  const ratio = alphaCount / text.length
  if (ratio < 0.4) return false // less than 40% letters = binary/junk
  // Reject strings with suspicious short token density (binary noise)
  const weirdTokens = (text.match(/[A-Za-z]{1,2}\s+[A-Za-z]{1,2}\s+[A-Za-z]{1,2}/g) || []).length
  const wordCount = (text.match(/\b\w{3,}\b/g) || []).length
  if (wordCount < 5) return false
  if (weirdTokens > wordCount * 0.6) return false
  return true
}

/** Extract paragraphs from text for per-paragraph scoring */
function extractParagraphs(text: string): { text: string; start: number }[] {
  const paras: { text: string; start: number }[] = []
  let pos = 0
  for (const para of text.split(/\n{2,}/)) {
    const clean = para.trim()
    if (isReadableParagraph(clean)) paras.push({ text: clean, start: pos })
    pos += para.length + 2
  }
  return paras
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimitDB('pdf', ip)
  if (rl.limited) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again in a minute.' } },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(rl.reset) } }
    )
  }

  let userId = 'unknown'
  try {
    const guard = await creditGuard(req, 'text')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication required' } }, { status: 401 })
  }

  const start = Date.now()
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const rawText = form.get('text') as string | null

    let fullText = ''
    let sourceType: 'pdf' | 'text' = 'text'

    if (file) {
      if (file.size > MAX_PDF_SIZE) {
        return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'File too large (max 20MB)' } }, { status: 400 })
      }
      if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
        return NextResponse.json({ success: false, error: { code: 'INVALID_TYPE', message: 'Only PDF files supported' } }, { status: 400 })
      }

      // Extract PDF text — pdf-parse v2 CJS API
      const bytes  = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Module 2.4: magic-byte validation. The client-side `file.type` can
      // be spoofed trivially (any binary renamed to .pdf gets `application/pdf`
      // in most browsers' file pickers). This check verifies the first 4
      // bytes are actually `%PDF` before the file reaches pdf-parse, blocking
      // a major class of malicious-input DoS vectors.
      const validation = validateDocumentUpload(buffer, 'application/pdf', file.size)
      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          error: { code: 'INVALID_FILE', message: validation.error },
        }, { status: 400 })
      }

      let rawPdfText = ''
      try {
        // pdf-parse v2: main CJS export exposes { PDFParse }
        // PDFParse constructor takes { data: Buffer, verbosity?: number }
        // then call .getText() -> Promise<{ text: string }>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PDFParse } = require('pdf-parse')
        const parser = new PDFParse({ data: buffer, verbosity: 0 })
        const textResult = await parser.getText()
        rawPdfText = textResult?.text ?? ''
        if (typeof parser.destroy === 'function') await parser.destroy()
      } catch (pdfErr: any) {
        // Module 2.10: was a latin1-strip fallback that produced non-empty
        // garbage from corrupt PDFs and passed it as "real text" to the
        // detection engine — confident but wrong verdicts. Now: fail
        // cleanly so the caller sees the actual parse failure.
        return NextResponse.json({
          success: false,
          error: {
            code: 'PARSE_FAILED',
            message: 'PDF could not be parsed. The file may be corrupt or password-protected.',
            detail: pdfErr?.message?.slice(0, 200) || String(pdfErr).slice(0, 200),
          },
        }, { status: 422 })
      }

      if (!rawPdfText.trim()) {
        return NextResponse.json({
          success: false,
          error: { code: 'PDF_EMPTY', message: 'Could not extract text from this PDF. It may be scanned or image-based.' }
        }, { status: 422 })
      }

      // Clean extracted text
      fullText = rawPdfText
        .replace(/\f/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s*\d+\s*$/gm, '')
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim()

      sourceType = 'pdf'
    } else if (rawText) {
      fullText = rawText
    } else {
      return NextResponse.json({ success: false, error: { code: 'NO_INPUT', message: 'Provide a PDF file or text' } }, { status: 400 })
    }

    if (fullText.length < 50) {
      return NextResponse.json({ success: false, error: { code: 'TOO_SHORT', message: 'Extracted text too short (min 50 chars)' } }, { status: 400 })
    }

    // For large texts: chunk and process in parallel
    const chunks = chunkText(fullText, CHUNK_SIZE, CHUNK_OVERLAP).slice(0, MAX_CHUNKS)
    const paragraphs = extractParagraphs(fullText).slice(0, 30)

    // Fast-path: if text is short enough, analyze directly
    if (fullText.length <= 3000 || chunks.length <= 2) {
      const result = await analyzeText(fullText.slice(0, 10000))
      const processingTime = Date.now() - start

      try { await getSupabaseAdmin().from('scans').insert({
        user_id: userId, media_type: 'text',
        content_preview: fullText.substring(0, 500),
        verdict: result.verdict, confidence_score: result.confidence,
        signals: result.signals, model_used: result.model_used,
        processing_time: processingTime, status: 'complete',
        metadata: { source: sourceType, char_count: fullText.length }
      }) } catch {}

      return NextResponse.json({
        success: true,
        data: sanitizeDetectionResultForClient({
          ...result,
          processing_time:  processingTime,
          char_count:       fullText.length,
          chunk_count:      1,
          source_type:      sourceType,
          full_text_length: fullText.length,
          paragraph_scores: [],
        }),
      })
    }

    // Parallel chunk processing with concurrency limit
    const CONCURRENCY = 5
    const chunkResults: ChunkResult[] = []
    let earlyResult: typeof chunkResults[0] | null = null

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async (chunk, j) => {
          const r = await analyzeText(chunk.text)
          return {
            chunkIndex: i + j,
            startChar:  chunk.start,
            endChar:    chunk.end,
            text:       chunk.text.slice(0, 200),
            verdict:    r.verdict,
            confidence: r.confidence,
          } as ChunkResult
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          chunkResults.push(r.value)
          // Fast-path: if first 5 chunks all show >90% AI, return early
          // Module 2.2: confidence is 0-1 float, not 0-100. Was: > 90 (always false).
          if (!earlyResult && chunkResults.length >= 5) {
            const highConf = chunkResults.filter(c => c.confidence > 0.90 && c.verdict === 'AI')
            if (highConf.length >= 4) earlyResult = chunkResults[0]
          }
        }
      }
    }

    // Aggregate results with weighted averaging
    // Module 2.2: confidence from analyzeText is 0-1 float, NOT 0-100.
    // Was: `c.verdict === 'AI' ? c.confidence : 100 - c.confidence` compared
    // to thresholds >=62/<=38 — for an AI verdict with confidence=0.85, the
    // expression evaluated to `0.85 >= 62` (false) and `0.85 <= 38` (true),
    // classifying every AI chunk as HUMAN. Every long AI-generated PDF was
    // misclassified as HUMAN. Now: defensive scale normalization (handles
    // both 0-1 and 0-100 in case any caller passes the old format).
    const totalWeight = chunkResults.length
    const aiScore = chunkResults.reduce((sum, c) => {
      const conf100 = c.confidence <= 1 ? c.confidence * 100 : c.confidence
      const score = c.verdict === 'AI' ? conf100 : c.verdict === 'HUMAN' ? 100 - conf100 : 50
      return sum + score
    }, 0) / Math.max(totalWeight, 1)

    const finalVerdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
      aiScore >= 62 ? 'AI' : aiScore <= 38 ? 'HUMAN' : 'UNCERTAIN'

    // Module 2.3: drop the top-10-paragraph re-scan.
    // Was: `paragraphs.slice(0, 10).map(async p => analyzeText(p.text))` —
    // 10 extra analyzeText calls (each = 6 HF models + Gemini + signal-worker)
    // on top of the chunk analysis. For a 10-paragraph PDF that's ~70 HF
    // calls within maxDuration=55s — blows the Vercel budget. The chunk
    // results already cover the same text. Now: derive paragraph scores
    // from the chunk that overlaps each paragraph (by char offset).
    const topParagraphs = paragraphs.slice(0, 10).map(p => {
      // Find the chunk that overlaps this paragraph's start offset
      const containingChunk = chunkResults.find(c =>
        p.start >= c.startChar && p.start < c.endChar,
      )
      return {
        text: p.text.slice(0, 300),
        start: p.start,
        confidence: containingChunk?.confidence ?? 0.5,
        verdict: containingChunk?.verdict ?? 'UNCERTAIN' as const,
      }
    })
      // Sort by AI-ness (AI chunks first, then UNCERTAIN, then HUMAN)
      .sort((a, b) => {
        const rank = (v: string) => v === 'AI' ? 0 : v === 'UNCERTAIN' ? 1 : 2
        if (rank(a.verdict) !== rank(b.verdict)) return rank(a.verdict) - rank(b.verdict)
        return b.confidence - a.confidence
      })
      .slice(0, 5)

    const processingTime = Date.now() - start

    // Aggregate signals from all chunks
    const allSignals = chunkResults.flatMap(c => (c as any).signals || [])

    const aggregatedResult = {
      verdict:      finalVerdict,
      confidence:   Math.round(aiScore),
      model_used:   'Aiscern-TextEnsemble(ChunkedPDF)',
      model_version:'4.0.0',
      summary: finalVerdict === 'AI'
        ? `Document shows ${Math.round(aiScore)}% AI-generation probability across ${chunkResults.length} analyzed segments.`
        : finalVerdict === 'HUMAN'
        ? `Document appears human-written — ${Math.round(100 - aiScore)}% confidence across ${chunkResults.length} segments.`
        : `Document shows mixed signals (${Math.round(aiScore)}% AI probability) — may be partially AI-generated.`,
      signals: [],
      processing_time: processingTime,
      char_count:      fullText.length,
      chunk_count:     chunkResults.length,
      source_type:     sourceType,
      full_text_length:fullText.length,
      paragraph_scores:topParagraphs,
      chunk_scores:    chunkResults.map(c => ({ index: c.chunkIndex, confidence: c.confidence, verdict: c.verdict })),
    }

    // Insert scan record and issue seal
    let pdfScanId: string | null = null
    try {
      const { data: pdfScanRow } = await getSupabaseAdmin().from('scans').insert({
        user_id: userId, media_type: 'text',
        content_preview: fullText.substring(0, 500),
        verdict: finalVerdict,
        confidence_score: Math.round(aiScore) / 100,
        processing_time: processingTime, status: 'complete',
        metadata: { source: sourceType, char_count: fullText.length, chunks: chunkResults.length }
      }).select('id').single()
      pdfScanId = pdfScanRow?.id ?? null
    } catch {}

    // Seal issuance — signed HMAC-SHA256 seal for every scan (non-fatal)
    let sealNumber: string | null = null
    let sealVerifyUrl: string | null = null
    if (pdfScanId) {
      try {
        const { issueSealForScan, sealVerifyUrl: buildSealUrl } = await import('@/lib/seal/issue')
        sealNumber = await issueSealForScan(pdfScanId, finalVerdict, aiScore / 100,
          { media_type: 'pdf', source: sourceType })
        sealVerifyUrl = buildSealUrl(sealNumber)
      } catch (e) { console.warn('[detect/pdf] seal issuance failed:', e) }
    }

    const resultWithSeal = { ...aggregatedResult, sealNumber, sealVerifyUrl }
    return NextResponse.json({ success: true, data: resultWithSeal })
  } catch (err: any) {
    console.error('[detect/pdf]', err)
    return NextResponse.json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: err?.message || 'Analysis failed' }
    }, { status: 500 })
  }
}
