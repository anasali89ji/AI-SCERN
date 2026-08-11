/**
 * GET /api/analytics/kpis
 *
 * Executive-level KPIs sourced from the MotherDuck `scan_archive` table
 * (lib/motherduck/client.ts). Admin-only — this is org-wide data, not a
 * single user's usage (see /api/analytics/customer for that).
 *
 * Note on scope: this queries `scan_archive`, which only contains scans
 * that have gone through the Inngest archiveScanToMotherDuck job (fires on
 * 'scan/completed'). There's a small lag between a scan completing and it
 * showing up here — for true real-time "scans today" while the archive is
 * still catching up, blend in a live COUNT from Supabase `scans` if needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAdminError } from '@/lib/auth/verify-admin'
import { queryMotherDuck } from '@/lib/motherduck/client'

export const dynamic = 'force-dynamic'

interface KpiRow {
  total_scans_today: number
  total_scans_month: number
  total_scans_all_time: number
  active_users_today: number
  active_users_month: number
  avg_confidence: number | null
  ai_detection_rate: number | null
  avg_processing_time_ms: number | null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const rows = await queryMotherDuck<KpiRow>(
    `SELECT
       (SELECT COUNT(*) FROM scan_archive WHERE CAST(scanned_at AS DATE) = CAST($1 AS DATE)) AS total_scans_today,
       (SELECT COUNT(*) FROM scan_archive WHERE scanned_at >= $2) AS total_scans_month,
       (SELECT COUNT(*) FROM scan_archive) AS total_scans_all_time,
       (SELECT COUNT(DISTINCT user_id) FROM scan_archive WHERE CAST(scanned_at AS DATE) = CAST($1 AS DATE)) AS active_users_today,
       (SELECT COUNT(DISTINCT user_id) FROM scan_archive WHERE scanned_at >= $2) AS active_users_month,
       (SELECT AVG(confidence_score) FROM scan_archive WHERE scanned_at >= $2) AS avg_confidence,
       (SELECT COUNT(*) FILTER (WHERE verdict = 'AI') * 100.0 / NULLIF(COUNT(*), 0) FROM scan_archive WHERE scanned_at >= $2) AS ai_detection_rate,
       (SELECT AVG(processing_time) FROM scan_archive WHERE scanned_at >= $2) AS avg_processing_time_ms`,
    [today, thirtyDaysAgo],
  )

  if (rows === null) {
    return NextResponse.json({ error: 'Analytics archive unavailable (MotherDuck not configured or unreachable)' }, { status: 503 })
  }

  return NextResponse.json(rows[0] ?? {
    total_scans_today: 0, total_scans_month: 0, total_scans_all_time: 0,
    active_users_today: 0, active_users_month: 0, avg_confidence: null,
    ai_detection_rate: null, avg_processing_time_ms: null,
  })
}
