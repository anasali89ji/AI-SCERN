/**
 * GET /api/reports/scan/[scanId]
 *
 * Generates a downloadable PDF verification report for a single scan —
 * embeds the actual scanned image, the full forensic signal breakdown, and
 * the perceptual fingerprint ("synth ID"), built for enterprise/HR-firm
 * use (a reviewer needs to *see* what was scanned, not just a score).
 *
 * Data source resolution:
 *   1. Try Supabase `scans` first (hot path — most scans live here).
 *   2. If not found (already purged by the user's data_retention_days
 *      cron — v18_data_retention_cron.sql), fall back to the MotherDuck
 *      archive (lib/motherduck/archive.ts). This is what makes "I scanned
 *      this 3 years ago, I need the report again" actually work.
 *   3. If the scan is an image and its R2 object still exists, embed it.
 *      If not (R2 object deleted, or archive-only metadata with no image),
 *      the report still generates — just without the embedded image.
 *
 * Auth: the requesting user must own the scan (or be an admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getArchivedScan, findByFingerprint } from '@/lib/motherduck/archive'
import { getR2Buffer } from '@/lib/storage/r2'
import { generateScanReportPDF, type ReportScanData } from '@/lib/reports/scan-report'
import type { DetectionSignal } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ADMIN_IDS = new Set((process.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean))

function parseSignals(raw: unknown): DetectionSignal[] {
  if (Array.isArray(raw)) return raw as DetectionSignal[]
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  return []
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    let reportData: ReportScanData | null = null

    // ── 1. Try the hot Supabase path first ─────────────────────────────────
    const sb = getSupabaseAdmin()
    const { data: scan } = await sb
      .from('scans')
      .select('id, user_id, media_type, verdict, confidence_score, model_used, file_name, file_size, r2_key, file_hash, perceptual_hash, signals, created_at')
      .eq('id', scanId)
      .single()

    if (scan) {
      if (scan.user_id !== userId && !ADMIN_IDS.has(userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      reportData = {
        scan_id: scan.id,
        media_type: scan.media_type,
        verdict: scan.verdict,
        confidence_score: scan.confidence_score,
        model_used: scan.model_used,
        file_name: scan.file_name,
        file_size: scan.file_size,
        perceptual_hash: scan.perceptual_hash,
        file_hash: scan.file_hash,
        signals: parseSignals(scan.signals),
        scanned_at: scan.created_at,
      }
      if (scan.media_type === 'image' && scan.r2_key) {
        try {
          const r2 = await getR2Buffer(scan.r2_key)
          reportData.imageBuffer = r2.buffer
          reportData.imageMimeType = r2.contentType
        } catch { /* R2 object may have been deleted independently — report still generates without it */ }
      }
    } else {
      // ── 2. Fall back to the MotherDuck archive (scan purged from Supabase) ──
      const archived = await getArchivedScan(scanId)
      if (!archived) {
        return NextResponse.json({ error: 'Scan not found (not in Supabase or the MotherDuck archive)' }, { status: 404 })
      }
      if (archived.user_id !== userId && !ADMIN_IDS.has(userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      reportData = {
        scan_id: archived.scan_id,
        media_type: archived.media_type,
        verdict: archived.verdict,
        confidence_score: archived.confidence_score,
        model_used: archived.model_used,
        file_name: archived.file_name,
        file_size: archived.file_size,
        perceptual_hash: archived.perceptual_hash,
        file_hash: null,
        signals: parseSignals(archived.signals),
        scanned_at: archived.scanned_at,
      }
      if (archived.media_type === 'image' && archived.r2_key) {
        try {
          const r2 = await getR2Buffer(archived.r2_key)
          reportData.imageBuffer = r2.buffer
          reportData.imageMimeType = r2.contentType
        } catch { /* R2 object may be gone too — report still generates from metadata alone */ }
      }
    }

    // ── Prior-scan fingerprint match, for the report's evidence footer ─────
    if (reportData.perceptual_hash && reportData.media_type === 'image') {
      try {
        const matches = await findByFingerprint(reportData.perceptual_hash, { userId, sameUserOnly: true })
        const prior = matches.find(m => m.scan_id !== reportData!.scan_id)
        if (prior) {
          reportData.priorMatch = {
            scan_id: prior.scan_id,
            scanned_at: prior.scanned_at,
            verdict: prior.verdict,
            hamming_distance: prior.hamming_distance,
          }
        }
      } catch { /* non-fatal */ }
    }

    const pdfBytes = await generateScanReportPDF(reportData)

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="aiscern-report-${scanId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[reports/scan]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Report generation failed' },
      { status: 500 },
    )
  }
}
