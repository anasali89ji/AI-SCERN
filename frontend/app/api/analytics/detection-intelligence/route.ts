/**
 * GET /api/analytics/detection-intelligence?days=30
 *
 * Model usage breakdown + confidence distribution across all archived scans.
 * Admin-only (org-wide aggregate, not scoped to one user).
 *
 * Adapted from the original integration spec, which assumed columns
 * (`model_detected`, `detector`) that don't exist in Aiscern's real schema.
 * The real signal is `model_used` (populated on every scans insert — see
 * app/api/detect/image/route.ts etc) and `media_type`, both of which are
 * mirrored into scan_archive by lib/motherduck/archive.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { queryMotherDuck } from '@/lib/motherduck/client'

export const dynamic = 'force-dynamic'

const ADMIN_IDS = new Set((process.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean))

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_IDS.has(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const days = Math.max(1, Math.min(365, parseInt(req.nextUrl.searchParams.get('days') || '30', 10)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [modelUsage, confidenceDist, mediaTypeBreakdown] = await Promise.all([
    queryMotherDuck(
      `SELECT model_used, COUNT(*) AS count
       FROM scan_archive
       WHERE scanned_at >= $1 AND model_used IS NOT NULL
       GROUP BY model_used
       ORDER BY count DESC
       LIMIT 10`,
      [since],
    ),
    queryMotherDuck(
      `SELECT
         CASE
           WHEN confidence_score >= 0.9 THEN 'Very High (90-100%)'
           WHEN confidence_score >= 0.7 THEN 'High (70-89%)'
           WHEN confidence_score >= 0.5 THEN 'Medium (50-69%)'
           ELSE 'Low (<50%)'
         END AS bucket,
         COUNT(*) AS count
       FROM scan_archive
       WHERE scanned_at >= $1 AND confidence_score IS NOT NULL
       GROUP BY bucket
       ORDER BY count DESC`,
      [since],
    ),
    queryMotherDuck(
      `SELECT media_type, COUNT(*) AS scans, AVG(confidence_score) AS avg_confidence
       FROM scan_archive
       WHERE scanned_at >= $1
       GROUP BY media_type
       ORDER BY scans DESC`,
      [since],
    ),
  ])

  if (modelUsage === null && confidenceDist === null && mediaTypeBreakdown === null) {
    return NextResponse.json({ error: 'Analytics archive unavailable' }, { status: 503 })
  }

  return NextResponse.json({
    topModels: modelUsage ?? [],
    confidenceDistribution: confidenceDist ?? [],
    mediaTypeBreakdown: mediaTypeBreakdown ?? [],
  })
}
