import { NextRequest, NextResponse } from 'next/server'
import { analyzeText, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic    = 'force-dynamic'
export const maxDuration = 120  // large PDFs need time

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

/** Extract paragraphs from text for per-paragraph scoring */
function extractParagraphs(text: string): { text: string; start: number }[] {
  const paras: { text: string; start: number }[] = []
  let pos = 0
  for (const para of text.split(/\n{2,}/)) {
    const clean = para.trim()
    if (clean.length >= 80) paras.push({ text: clean, start: pos })
    pos += para.length + 2
  }
  return paras
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (!checkRateLimit(ip, 5)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })
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

      // Extract PDF text using pdf-parse
      const bytes  = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      // Dynamic import to avoid build issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const pdfData  = await pdfParse(buffer, {
        max: 0,  // parse all pages
        pagerender: (pageData: any) => {
          return pageData.getTextContent({ normalizeWhitespace: true })
            .then((textContent: any) => {
              return textContent.items
                .map((item: any) => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
            })
        },
      })

      // Clean extracted text
      fullText = pdfData.text
        .replace(/\f/g, '\n\n')              // form feeds → paragraph breaks
        .replace(/[ \t]+/g, ' ')             // normalize whitespace
        .replace(/\n{3,}/g, '\n\n')          // max 2 newlines
        .replace(/^\s*\d+\s*$/gm, '')        // remove page numbers
        .replace(/[^\x20-\x7E\n]/g, '')      // remove non-printable chars
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
        data: {
          ...result,
          processing_time:  processingTime,
          char_count:       fullText.length,
          chunk_count:      1,
          source_type:      sourceType,
          full_text_length: fullText.length,
          paragraph_scores: [],
        }
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
          if (!earlyResult && chunkResults.length >= 5) {
            const highConf = chunkResults.filter(c => c.confidence > 90 && c.verdict === 'AI')
            if (highConf.length >= 4) earlyResult = chunkResults[0]
          }
        }
      }
    }

    // Aggregate results with weighted averaging
    const totalWeight = chunkResults.length
    const aiScore = chunkResults.reduce((sum, c) => {
      const score = c.verdict === 'AI' ? c.confidence : c.verdict === 'HUMAN' ? 100 - c.confidence : 50
      return sum + score
    }, 0) / Math.max(totalWeight, 1)

    const finalVerdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
      aiScore >= 62 ? 'AI' : aiScore <= 38 ? 'HUMAN' : 'UNCERTAIN'

    // Top 5 most AI-probable paragraphs
    const paraScores = await Promise.allSettled(
      paragraphs.slice(0, 10).map(async p => {
        const r = await analyzeText(p.text.slice(0, 1500))
        return { text: p.text.slice(0, 300), start: p.start, confidence: r.confidence, verdict: r.verdict }
      })
    )
    const topParagraphs = paraScores
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as any).value)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    const processingTime = Date.now() - start

    // Aggregate signals from all chunks
    const allSignals = chunkResults.flatMap(c => (c as any).signals || [])

    const aggregatedResult = {
      verdict:      finalVerdict,
      confidence:   Math.round(aiScore),
      model_used:   'DETECTAI-TextEnsemble(ChunkedPDF)',
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

    try { await getSupabaseAdmin().from('scans').insert({ user_id: userId, media_type: 'text', content_preview: fullText.substring(0, 500), verdict: finalVerdict, confidence_score: Math.round(aiScore) / 100, processing_time: processingTime, status: 'complete', metadata: { source: sourceType, char_count: fullText.length, chunks: chunkResults.length } }) } catch {}

    return NextResponse.json({ success: true, data: aggregatedResult })
  } catch (err: any) {
    console.error('[detect/pdf]', err)
    return NextResponse.json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: err?.message || 'Analysis failed' }
    }, { status: 500 })
  }
}
