import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const since = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: analytics } = await db.from('marketing_analytics').select('*').gte('created_at', since).order('date', { ascending: true })
  const { data: referrers } = await db.from('marketing_analytics').select('referrer, visits').not('referrer', 'is', null).limit(10)
  const { data: utm } = await db.from('marketing_analytics').select('utm_source, utm_medium, visits, signups').not('utm_source', 'is', null).limit(10)

  const totalVisits = (analytics || []).reduce((a, b) => a + (b.visits || 0), 0)
  const totalSignups = (analytics || []).reduce((a, b) => a + (b.signups || 0), 0)
  const uniqueVisitors = (analytics || []).reduce((a, b) => a + (b.unique_visitors || 0), 0)

  return NextResponse.json({
    kpis: {
      total_visits: totalVisits,
      unique_visitors: uniqueVisitors,
      signups: totalSignups,
      conversion_rate: totalVisits > 0 ? (totalSignups / totalVisits) * 100 : 0,
    },
    traffic_daily: analytics || [],
    referrers: (referrers || []).map(r => ({ name: r.referrer, value: r.visits })),
    utm_performance: utm || [],
  })
}
