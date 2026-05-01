import { NextRequest, NextResponse } from 'next/server'
import { analyzeText }               from '@/lib/inference/hf-analyze'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { getCachedDetection, setCachedDetection, contentHash } from '@/lib/cache/detection-cache'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { fireScanCompleted }                           from '@/lib/inngest/send-scan-event'
import { sanitizeText } from '@/lib/utils/sanitize'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { webSearch }               from '@/lib/graph-rag/web-search'
import { extractEntities, generateSearchTerms } from '@/lib/graph-rag/entity-extractor'
import { buildGraph, traverseGraph, formatGraphContext } from '@/lib/graph-rag/graph-builder'
import { runMiniAgents }           from '@/lib/graph-rag/agent-orchestrator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  const rl = await checkRateLimit('text', ip)
  if (rl.limited) {
    return NextResponse.json(rateLimitResponse(), {
      status: 429,
      headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': rl.reset.toString() },
    })
  }

  const internalSecret = req.headers.get('X-Internal-Secret')
  const isInternal     = internalSecret && internalSecret === process.env.INTERNAL_API_SECRET

  let userId: string
  if (isInternal) {
    userId = 'internal'
  } else {
    try {
      const guard = await creditGuard(req, 'text')
      userId      = guard.userId
    } catch (err) {
      if (err instanceof HTTPError) return httpErrorResponse(err)
      return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Request failed' } }, { status: 500 })
    }
  }

  const start = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const { text } = body

    if (!text || typeof text !== 'string')
      return NextResponse.json({ success: false, error: { code: 'NO_TEXT', message: 'No text provided' } }, { status: 400 })
    if (text.length < 50)
      return NextResponse.json({ success: false, error: { code: 'TOO_SHORT', message: 'Text must be at least 50 characters' } }, { status: 400 })
    if (text.length > 10000)
      return NextResponse.json({ success: false, error: { code: 'TOO_LONG', message: 'Text must be under 10,000 characters' } }, { status: 400 })

    const sanitized = sanitizeText(text)
    const hash   = contentHash(sanitized)
    const cached = await getCachedDetection('text', hash)
    if (cached) {
      return NextResponse.json({
        success: true, scan_id: null, cached: true,
        result:  { ...cached, processing_time: Date.now() - start },
      })
    }

    const result         = await analyzeText(sanitized)
    const processingTime = Date.now() - start

    await setCachedDetection('text', hash, result)

    let scanId: string | null = null
    if (userId !== 'internal' && !userId.startsWith('anon_')) {
      try {
        const { data: scanRow } = await getSupabaseAdmin().from('scans').insert({
          user_id:          userId,
          media_type:       'text',
          content_preview:  sanitized.substring(0, 500),
          verdict:          result.verdict,
          confidence_score: result.confidence,
          signals:          result.signals,
          processing_time:  processingTime,
          model_used:       result.model_used,
          model_version:    result.model_version,
          status:           'complete',
          metadata:         { char_count: sanitized.length, word_count: sanitized.split(/\s+/).length },
        }).select('id').single()
        scanId = scanRow?.id ?? null
      } catch { /* non-fatal */ }
    } else if (userId.startsWith('anon_')) {
      // Save anonymous scans for analytics (anon_id column now exists)
      try {
        await getSupabaseAdmin().from('scans').insert({
          user_id:          null,
          anon_id:          userId,
          media_type:       'text',
          content_preview:  sanitized.substring(0, 200),
          verdict:          result.verdict,
          confidence_score: result.confidence,
          processing_time:  processingTime,
          model_used:       result.model_used,
          status:           'complete',
        })
      } catch { /* non-fatal */ }
    }

    // Fire Inngest background job (fire-and-forget, non-blocking)
    if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'text', verdict: result.verdict, confidence: result.confidence, model_used: result.model_used })

    // ── Graph RAG web verification (non-blocking, 10s timeout) ────────────────
    let graph_context: string | null = null
    if (result.verdict === 'AI' || result.confidence > 0.55) {
      try {
        const verifyTimeout = new Promise<null>(res => setTimeout(() => res(null), 10_000))
        const verifyWork = (async () => {
          const snippet  = sanitized.slice(0, 300)
          const entities = extractEntities(snippet, 8)
          const terms    = generateSearchTerms(snippet, entities, 'scan')
          if (!terms.length) return null
          const webResults = await webSearch(terms, 3)
          if (!webResults.length) return null
          const graph    = buildGraph(snippet, webResults, [])
          const topNodes = traverseGraph(graph, 8)
          const ctx      = formatGraphContext(topNodes, webResults, snippet, 'scan')
          const agentCtx = await runMiniAgents(snippet, graph, webResults, 'scan').catch(() => '')
          return [ctx, agentCtx].filter(Boolean).join('\n\n') || null
        })()
        graph_context = await Promise.race([verifyWork, verifyTimeout])
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      result:  { ...result, processing_time: processingTime },
      ...(graph_context ? { graph_context } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}
