// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Batch Detection API
// POST /api/detect/batch
//
// Accepts up to 10 items in a single request and runs the full detection
// pipeline on each in parallel. Wires both:
//   • Image Detection Brain v2.0 (sharp pixel decode, 16 signals)
//   • Text Detection Brain v1.0  (200+ phrase fingerprints, 9 signals)
//
// Request body (JSON):
//   {
//     items: Array<{
//       type: 'text' | 'image' | 'url'
//       content?: string          // text or base64 image
//       url?: string              // for type='url' — page to fetch & analyse
//       mimeType?: string         // for type='image', default 'image/jpeg'
//       label?: string            // optional caller tag (returned as-is)
//     }>
//   }
//
// Response:
//   {
//     success: true
//     results: Array<BatchItemResult>
//     summary: { total, ai, human, uncertain, processing_ms }
//   }
// ════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse }    from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { analyzeText, analyzeImage }    from '@/lib/inference/hf-analyze'
import { fetchPageContent }             from '@/lib/utils/fetch-page'
import { getSupabaseAdmin }             from '@/lib/supabase/admin'
import { fireScanCompleted }            from '@/lib/inngest/send-scan-event'

export const dynamic    = 'force-dynamic'
export const maxDuration = 120

const MAX_BATCH  = 10
const MAX_TEXT   = 50_000
const MAX_IMG_B64 = 10 * 1024 * 1024 * 1.34  // base64 overhead ~33%

interface BatchItem {
  type:     'text' | 'image' | 'url'
  content?: string
  url?:     string
  mimeType?: string
  label?:   string
}

interface BatchItemResult {
  index:    number
  label?:   string
  type:     string
  verdict:  'AI' | 'HUMAN' | 'UNCERTAIN' | 'ERROR'
  confidence?: number
  summary?: string
  model_used?: string
  generator_hints?: string[]
  decoded_pixels?:  boolean
  error?:   string
}

// ── URL detection helper ───────────────────────────────────────────────────────
// Fetches a page via Jina Reader and runs text detection on its content.
// Also checks for common AI blog-post patterns (uniform paragraph lengths,
// excessive hedging phrases, no personal anecdotes, suspiciously clean structure).

async function detectFromUrl(url: string): Promise<{ text: string; blogPatternScore: number }> {
  const content = await fetchPageContent(url, 8000)
  if (!content || content.length < 100) throw new Error(`Could not fetch content from ${url}`)

  // Blog post AI pattern analysis
  const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 80)
  const wordCounts = paragraphs.map(p => p.split(/\s+/).length)
  const wcStats    = wordCounts.length > 1 ? (() => {
    const m   = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
    const std = Math.sqrt(wordCounts.reduce((a, b) => a + (b - m) ** 2, 0) / wordCounts.length)
    return { mean: m, std, cv: m > 0 ? std / m : 0 }
  })() : { mean: 0, std: 0, cv: 1 }

  // AI blog patterns: uniform paragraph length (low CV), transition phrases, listicles
  const aiTransitions = [
    'furthermore', 'moreover', 'in conclusion', 'it is worth noting', 'it is important to',
    'in this article', 'in this blog post', 'in summary', 'to summarize', 'as we have seen',
    'let us explore', "let's explore", 'this comprehensive guide', 'in today\'s world',
    'in the digital age', 'revolutionizing', 'game-changing', 'cutting-edge', 'state-of-the-art',
    'seamlessly', 'leverage', 'delve into', 'dive into', 'harness the power',
  ]
  const contentLower = content.toLowerCase()
  const transitionCount = aiTransitions.filter(t => contentLower.includes(t)).length
  const transitionScore = transitionCount >= 8 ? 0.90 : transitionCount >= 5 ? 0.75 : transitionCount >= 3 ? 0.55 : 0.20

  // Paragraph uniformity (AI: low CV < 0.25; Real: high CV > 0.5)
  const uniformScore = wcStats.cv < 0.20 ? 0.88 : wcStats.cv < 0.35 ? 0.68 : wcStats.cv < 0.55 ? 0.42 : 0.18

  // Header density (AI blog posts: many H2/H3 headers)
  const headerCount = (content.match(/^#{1,3} /gm) || []).length
  const headerScore = headerCount > 8 ? 0.80 : headerCount > 5 ? 0.62 : 0.22

  // No first-person authentic anecdotes
  const personalCount = (content.match(/\bI (was|have|had|remember|once|used to|grew up)\b/g) || []).length
  const personalScore = personalCount === 0 ? 0.72 : personalCount < 2 ? 0.50 : 0.20

  const blogPatternScore = Math.min(0.97, transitionScore * 0.35 + uniformScore * 0.30 + headerScore * 0.20 + personalScore * 0.15)

  return { text: content, blogPatternScore }
}

// ── Process single item ────────────────────────────────────────────────────────

async function processItem(item: BatchItem, index: number, userId: string): Promise<BatchItemResult> {
  try {
    if (item.type === 'text') {
      if (!item.content) return { index, label: item.label, type: 'text', verdict: 'ERROR', error: 'No content provided' }
      const text   = item.content.slice(0, MAX_TEXT)
      const result = await analyzeText(text)
      return {
        index, label: item.label, type: 'text',
        verdict: result.verdict, confidence: result.confidence,
        summary: result.summary, model_used: result.model_used,
      }
    }

    if (item.type === 'image') {
      if (!item.content) return { index, label: item.label, type: 'image', verdict: 'ERROR', error: 'No content provided' }
      // Accept raw base64 or data URL
      const b64    = item.content.replace(/^data:image\/[a-z+]+;base64,/, '')
      if (b64.length > MAX_IMG_B64) return { index, label: item.label, type: 'image', verdict: 'ERROR', error: 'Image too large (max 10MB)' }
      const buffer = Buffer.from(b64, 'base64')
      const mime   = item.mimeType ?? 'image/jpeg'
      const result = await analyzeImage(buffer, mime, item.label ?? `batch_${index}`)
      // Extract generator hints and decodedPixels from signals if present
      const genSignal     = result.signals?.find(s => s.name === 'Image Detection Brain')
      const generatorHints: string[] = []
      if (genSignal?.description?.includes('Generator:')) {
        const m = genSignal.description.match(/Generator: ([^.]+)\./)
        if (m) generatorHints.push(...m[1].split(/[|;]/).map(s => s.trim()).filter(Boolean))
      }
      return {
        index, label: item.label, type: 'image',
        verdict: result.verdict, confidence: result.confidence,
        summary: result.summary, model_used: result.model_used,
        generator_hints: generatorHints,
      }
    }

    if (item.type === 'url') {
      if (!item.url) return { index, label: item.label, type: 'url', verdict: 'ERROR', error: 'No URL provided' }
      // Validate URL
      let parsedUrl: URL
      try { parsedUrl = new URL(item.url) } catch { return { index, label: item.label, type: 'url', verdict: 'ERROR', error: 'Invalid URL' } }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return { index, label: item.label, type: 'url', verdict: 'ERROR', error: 'Only http/https URLs allowed' }

      const { text, blogPatternScore } = await detectFromUrl(item.url)
      const textResult = await analyzeText(text.slice(0, MAX_TEXT))

      // Blend blog pattern score with text detection (blog pattern = 20% weight)
      const blendedConfidence = textResult.confidence * 0.80 + blogPatternScore * 0.20
      const blendedVerdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
        blendedConfidence > 0.65 ? 'AI' : blendedConfidence < 0.35 ? 'HUMAN' : 'UNCERTAIN'

      return {
        index, label: item.label ?? item.url, type: 'url',
        verdict: blendedVerdict,
        confidence: Math.round(blendedConfidence * 1000) / 1000,
        summary: `${textResult.summary} Blog pattern score: ${Math.round(blogPatternScore * 100)}%`,
        model_used: `${textResult.model_used}+BlogPatternAnalysis`,
      }
    }

    return { index, label: item.label, type: item.type, verdict: 'ERROR', error: `Unknown type: ${item.type}` }
  } catch (err) {
    return { index, label: item.label, type: item.type ?? 'unknown', verdict: 'ERROR', error: err instanceof Error ? err.message : 'Processing failed' }
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl  = await checkRateLimit('text', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  let userId: string
  try {
    const guard = await creditGuard(req, 'text')
    userId      = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Auth failed' } }, { status: 500 })
  }

  let body: { items?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, { status: 400 }) }

  if (!Array.isArray(body?.items)) return NextResponse.json({ success: false, error: { code: 'INVALID_BODY', message: '"items" array required' } }, { status: 400 })

  const items = body.items as BatchItem[]
  if (items.length === 0) return NextResponse.json({ success: false, error: { code: 'EMPTY', message: 'No items provided' } }, { status: 400 })
  if (items.length > MAX_BATCH) return NextResponse.json({ success: false, error: { code: 'TOO_MANY', message: `Max ${MAX_BATCH} items per batch` } }, { status: 400 })

  const start   = Date.now()
  // Run all items in parallel
  const results = await Promise.all(items.map((item, i) => processItem(item, i, userId)))

  const processing_ms = Date.now() - start
  const ai            = results.filter(r => r.verdict === 'AI').length
  const human         = results.filter(r => r.verdict === 'HUMAN').length
  const uncertain     = results.filter(r => r.verdict === 'UNCERTAIN').length
  const errors        = results.filter(r => r.verdict === 'ERROR').length

  // Save batch scan record to DB (non-fatal)
  if (userId && !userId.startsWith('anon_')) {
    try {
      await getSupabaseAdmin().from('scans').insert({
        user_id:          userId,
        media_type:       'text',
        file_name:        `batch_${items.length}_items`,
        verdict:          ai > human + uncertain ? 'AI' : human > ai + uncertain ? 'HUMAN' : 'UNCERTAIN',
        confidence_score: results.filter(r => r.confidence != null).reduce((s, r) => s + (r.confidence ?? 0), 0) / (results.length || 1),
        processing_time:  processing_ms,
        model_used:       'Aiscern-BatchEngine-v1',
        status:           'complete',
        metadata:         { batch_size: items.length, ai, human, uncertain, errors, types: [...new Set(items.map(i => i.type))] },
      })
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: { total: items.length, ai, human, uncertain, errors, processing_ms },
  })
}
