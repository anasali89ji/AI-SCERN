/**
 * GET /api/analytics/customer?days=30
 *
 * Per-user usage analytics from the MotherDuck archive — powers the
 * customer-facing usage page (Module 6) and can feed the enterprise PDF
 * report's summary section for a full account/date-range view rather
 * than a single scan. Scoped to the caller's own user_id; no admin
 * check needed since every user can only see their own data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { queryMotherDuck } from '@/lib/motherduck/client'

export const dynamic = 'force-dynamic'

interface CustomerSummary {
  total_scans: number
  active_days: number
  avg_confidence: number | null
  avg_processing_time_ms: number | null
  ai_detections: number
  human_detections: number
  uncertain_detections: number
}

interface DailyTrendRow {
  day: string
  scans: number
  avg_confidence: number | null
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.max(1, Math.min(365, parseInt(req.nextUrl.searchParams.get('days') || '30', 10)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [summary, dailyTrend] = await Promise.all([
    queryMotherDuck<CustomerSummary>(
      `SELECT
         COUNT(*) AS total_scans,
         COUNT(DISTINCT CAST(scanned_at AS DATE)) AS active_days,
         AVG(confidence_score) AS avg_confidence,
         AVG(processing_time) AS avg_processing_time_ms,
         COUNT(*) FILTER (WHERE verdict = 'AI') AS ai_detections,
         COUNT(*) FILTER (WHERE verdict = 'HUMAN') AS human_detections,
         COUNT(*) FILTER (WHERE verdict = 'UNCERTAIN' OR verdict IS NULL) AS uncertain_detections
       FROM scan_archive
       WHERE user_id = $1 AND scanned_at >= $2`,
      [userId, since],
    ),
    queryMotherDuck<DailyTrendRow>(
      `SELECT CAST(scanned_at AS DATE) AS day, COUNT(*) AS scans, AVG(confidence_score) AS avg_confidence
       FROM scan_archive
       WHERE user_id = $1 AND scanned_at >= $2
       GROUP BY day
       ORDER BY day`,
      [userId, since],
    ),
  ])

  if (summary === null && dailyTrend === null) {
    // Archive unavailable — not necessarily an error the user needs to see;
    // customer-facing usage page should treat this as "no data yet" rather
    // than a hard failure, since MotherDuck being briefly down shouldn't
    // block someone from using the product.
    return NextResponse.json({ summary: null, dailyTrend: [], archiveAvailable: false })
  }

  return NextResponse.json({
    summary: summary?.[0] ?? null,
    dailyTrend: dailyTrend ?? [],
    archiveAvailable: true,
  })
}
