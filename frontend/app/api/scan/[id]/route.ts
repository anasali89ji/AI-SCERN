import { NextRequest, NextResponse } from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Polled by the client after an async detection kick-off (currently: image
 * detection via the Cloudflare worker hand-off, see /api/detect/image).
 * Returns just enough for the client to know whether to keep polling.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })

  const { id } = await params
  const db = getSupabaseAdmin()

  const { data: scan } = await db.from('scans')
    .select('id, user_id, status, verdict, confidence_score, signals, processing_time, model_used, model_version, file_name, file_size, metadata, error_message')
    .eq('id', id)
    .single()

  if (!scan || scan.user_id !== userId) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Scan not found' } }, { status: 404 })
  }

  if (scan.status === 'failed') {
    return NextResponse.json({
      success: true, scan_id: scan.id, status: 'failed',
      error: scan.error_message ?? 'Analysis failed',
    })
  }

  if (scan.status !== 'complete') {
    return NextResponse.json({ success: true, scan_id: scan.id, status: scan.status ?? 'processing' })
  }

  const meta = (scan.metadata as Record<string, unknown>) ?? {}
  return NextResponse.json({
    success: true, scan_id: scan.id, status: 'complete',
    result: {
      verdict:                scan.verdict,
      confidence:              scan.confidence_score,
      signals:                 scan.signals,
      summary:                 meta.summary ?? '',
      model_used:              scan.model_used,
      model_version:           scan.model_version,
      processing_time:         scan.processing_time,
      file_name:               scan.file_name,
      file_size:                scan.file_size,
      generator_attribution:   meta.generator_attribution ?? null,
      degraded_signals:        meta.degraded_signals ?? [],
      model_breakdown:         meta.model_breakdown ?? [],
    },
  })
}
