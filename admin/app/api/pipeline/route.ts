import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  const { data: stats } = await db.from('pipeline_stats').select('*').order('created_at', { ascending: false }).limit(1).single()
  const { data: recent } = await db.from('pipeline_stats').select('commit_id, status, created_at').order('created_at', { ascending: false }).limit(10)
  const { data: workers } = await db.from('pipeline_stats').select('worker_id, items, avg_q').not('worker_id', 'is', null).limit(10)

  return NextResponse.json({
    pipeline: {
      total_scraped: stats?.total_scraped || 0,
      total_pushed: stats?.total_pushed || 0,
    },
    d1_buffer: {
      total: stats?.items || 0,
      pending: Math.max(0, (stats?.items || 0) - (stats?.total_pushed || 0)),
    },
    worker_stats: workers || [],
    recent_pushes: recent || [],
  })
}
