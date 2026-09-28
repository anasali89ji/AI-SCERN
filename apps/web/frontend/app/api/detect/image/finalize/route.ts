import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { fireScanCompleted }         from '@/lib/inngest/send-scan-event'
import { logModelPredictions }       from '@/lib/accuracy/log-predictions'
import { queryDetectionRAG }         from '@/lib/rag/detection-rag'
import { getR2PublicUrl } from '@/lib/storage/r2'

export const dynamic = 'force-dynamic'

/**
 * Callback target for the Cloudflare image-ensemble worker. Never called by
 * the browser — auth is a shared secret header, not a user session.
 *
 * This route does everything the old synchronous /api/detect/image path did
 * AFTER getting its result back from analyzeImage(): RAG blending, DB update,
 * firing the scan-completed Inngest event, firing the forensic cascade, and
 * accuracy-monitoring logging. Mirrors that logic — see the sync fallback
 * path in ../route.ts for the reference implementation these should stay in
 * sync with if either changes.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('X-Worker-Secret')
  const expected = process.env.IMAGE_WORKER_SECRET
  if (!expected || auth !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    scanId: string
    userId: string
    error?: string
    result?: {
      verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
      confidence: number
      model_used: string
      model_version: string
      generator_attribution: { generator: string; corroborating_sources: string[]; confidence: 'high' | 'low' } | null
      degraded_signals: string[]
      signals: unknown[]
      model_breakdown: { model_id: string; raw_score: number; verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'; latency_ms: number }[]
      summary: string
      processing_time: number
    }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { scanId, userId, result, error } = body
  if (!scanId) return NextResponse.json({ success: false, error: 'Missing scanId' }, { status: 400 })

  const sb = getSupabaseAdmin()

  // Worker-side failure — mark the scan as failed so the client's poll loop
  // stops waiting instead of spinning forever.
  if (error || !result) {
    await sb.from('scans').update({
      status:        'failed',
      error_message: error ?? 'Worker returned no result',
    }).eq('id', scanId)
    return NextResponse.json({ success: true, marked_failed: true })
  }

  // ── RAG blending — same logic/thresholds as the sync path ──────────────────
  let finalVerdict    = result.verdict
  let finalConfidence = result.confidence
  let ragResult: any  = null
  if (process.env.DETECTION_RAG_ENABLED === 'true') {
    try {
      const imageDescription = (result.signals?.[0] as any)?.description ?? result.summary ?? 'uploaded image'
      ragResult = await queryDetectionRAG(imageDescription, 'image', result.confidence)
      if (ragResult?.rag_applied) {
        finalConfidence = ragResult.blended_score
        if (finalConfidence >= 0.55)      finalVerdict = 'AI'
        else if (finalConfidence <= 0.40) finalVerdict = 'HUMAN'
        else                               finalVerdict = 'UNCERTAIN'
      }
    } catch (e) {
      console.warn('[detect/image/finalize] RAG query error (non-blocking):', e)
    }
  }

  // ── Update the 'processing' scans row created by the initial request ──────
  // summary/generator_attribution/degraded_signals/model_breakdown have no
  // dedicated columns on `scans` (confirmed against types/index.ts Scan) —
  // they go into `metadata`, merged with what the initial insert already set
  // (format/size_kb/r2) rather than overwriting it.
  const { data: existingRow } = await sb.from('scans').select('metadata, r2_key').eq('id', scanId).single()
  const { data: scanRow } = await sb.from('scans')
    .update({
      verdict:          finalVerdict,
      confidence_score: finalConfidence,
      signals:          result.signals,
      processing_time:  result.processing_time,
      model_used:       result.model_used,
      model_version:    result.model_version,
      status:           'complete',
      metadata: {
        ...(existingRow?.metadata as Record<string, unknown> ?? {}),
        summary:                result.summary,
        generator_attribution:  result.generator_attribution,
        degraded_signals:       result.degraded_signals,
        model_breakdown:        result.model_breakdown,
        rag_applied:            ragResult?.rag_applied ?? false,
      },
    })
    .eq('id', scanId)
    .select('r2_key')
    .single()

  fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'image', verdict: finalVerdict, confidence: finalConfidence, model_used: result.model_used })

  if (result.model_breakdown?.length) {
    void logModelPredictions(scanId, 'image', result.model_breakdown, finalVerdict)
  }

  // ── Forensic cascade — same fire-and-forget pattern as the sync path ──────
  const r2Key = scanRow?.r2_key ?? null
  if (r2Key) {
    try {
      const { inngest } = await import('@/lib/inngest/client')
      const forensicScanId = crypto.randomUUID()
      const imageUrl = getR2PublicUrl(r2Key)

      const brainSig = (result.signals as any[])?.find((s: any) => s.name === 'Image Detection Brain')
      const genHintMatch = brainSig?.description?.match(/Generator: ([^.]+)/)
      const brainBreakdown = result.model_breakdown?.find(m => m.model_id === 'image-brain-v2')
      const brainTelemetry = brainBreakdown
        ? {
            score: brainBreakdown.raw_score, verdict: brainBreakdown.verdict,
            generatorHints: genHintMatch ? genHintMatch[1].split('; ').filter(Boolean) : [],
            description: brainSig?.description ?? '',
          }
        : null

      const { error: insertErr } = await sb.from('forensic_scans').insert({
        id: forensicScanId, image_url: imageUrl, r2_key: r2Key,
        user_id: userId && !userId.startsWith('anon_') ? userId : null,
        status: 'pending', layers: [], semantic_agents: [], provenance: null, final_verdict: null,
        existing_ensemble_result: { confidence: finalConfidence, label: finalVerdict === 'AI' ? 'ai' : finalVerdict === 'HUMAN' ? 'human' : 'uncertain' },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      if (!insertErr) {
        await inngest.send({
          name: 'scan/image.forensic-cascade' as any,
          data: {
            scanId: forensicScanId, imageUrl, r2Key,
            existingEnsembleResult: { confidence: finalConfidence, label: finalVerdict === 'AI' ? 'ai' : finalVerdict === 'HUMAN' ? 'human' : 'uncertain' },
            brainTelemetry,
          },
        })
      }
    } catch (e) {
      console.warn('[detect/image/finalize] forensic cascade fire failed (non-blocking):', e)
    }
  }

  return NextResponse.json({ success: true })
}
