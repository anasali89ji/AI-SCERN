/**
 * GET /api/analytics/customer/export
 *
 * Downloads a CSV of the caller's complete scan history from the MotherDuck
 * archive — this is deliberately NOT scoped to the same 30/90-day windows as
 * the dashboard views, since the whole point of the archive is that it holds
 * scans Supabase's retention cron has already purged. An HR/enterprise user
 * auditing "everything we've ever scanned" needs the full history, not a
 * recent slice.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getScanHistoryForReport } from '@/lib/motherduck/archive'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function csvEscape(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mediaType = req.nextUrl.searchParams.get('mediaType') || undefined

  const rows = await getScanHistoryForReport(userId, { mediaType, limit: 50000 })

  const header = ['scan_id', 'media_type', 'verdict', 'confidence_score', 'model_used', 'file_name', 'file_size', 'perceptual_hash', 'scanned_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      r.scan_id, r.media_type, r.verdict, r.confidence_score, r.model_used,
      r.file_name, r.file_size, r.perceptual_hash, r.scanned_at,
    ].map(csvEscape).join(','))
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aiscern-scan-history-${new Date().toISOString().split('T')[0]}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
