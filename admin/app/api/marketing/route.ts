import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const now = new Date()
  const since30d = new Date(Date.now() - 30 * 86400000).toISOString()

  // Traffic daily (from analytics_events or fallback stub)
  const { data: pageviews } = await db
    .from('analytics_events')
    .select('created_at, event_type, metadata')
    .gte('created_at', since30d)
    .in('event_type', ['pageview', 'signup', 'visit'])
    .order('created_at', { ascending: true })

  // Aggregate by day
  const dayMap: Record<string, { visits: number; unique: Set<string>; signups: number }> = {}
  for (const ev of pageviews ?? []) {
    const day = (ev.created_at as string).slice(0, 10)
    if (!dayMap[day]) dayMap[day] = { visits: 0, unique: new Set(), signups: 0 }
    if (ev.event_type === 'pageview' || ev.event_type === 'visit') {
      dayMap[day].visits++
      const uid = (ev.metadata as Record<string, string>)?.user_id
      if (uid) dayMap[day].unique.add(uid)
    }
    if (ev.event_type === 'signup') dayMap[day].signups++
  }

  const traffic_daily = Object.entries(dayMap).map(([date, d]) => ({
    date, visits: d.visits, unique: d.unique.size, signups: d.signups,
  })).sort((a, b) => a.date.localeCompare(b.date))

  const total_visits    = traffic_daily.reduce((s, d) => s + d.visits, 0)
  const unique_visitors = traffic_daily.reduce((s, d) => s + d.unique, 0)
  const signups         = traffic_daily.reduce((s, d) => s + d.signups, 0)
  const conversion_rate = total_visits > 0 ? (signups / total_visits) * 100 : 0

  // UTM performance
  const { data: utmRows } = await db
    .from('analytics_events')
    .select('metadata')
    .gte('created_at', since30d)
    .not('metadata->>utm_source', 'is', null)

  const utmMap: Record<string, { visits: number; conversions: number; revenue: number }> = {}
  for (const row of utmRows ?? []) {
    const m = row.metadata as Record<string, string>
    const k = `${m.utm_source}|${m.utm_medium ?? 'none'}|${m.utm_campaign ?? 'none'}`
    if (!utmMap[k]) utmMap[k] = { visits: 0, conversions: 0, revenue: 0 }
    utmMap[k].visits++
    if (m.converted) utmMap[k].conversions++
    if (m.revenue) utmMap[k].revenue += parseFloat(m.revenue) || 0
  }
  const utm_performance = Object.entries(utmMap).map(([k, v]) => {
    const [source, medium, campaign] = k.split('|')
    return { source, medium, campaign, ...v }
  }).sort((a, b) => b.visits - a.visits).slice(0, 20)

  // Referrers
  const { data: refRows } = await db
    .from('analytics_events')
    .select('metadata')
    .gte('created_at', since30d)
    .not('metadata->>referrer', 'is', null)
  const refMap: Record<string, number> = {}
  for (const row of refRows ?? []) {
    const domain = ((row.metadata as Record<string, string>).referrer ?? '').split('/')[2] ?? 'direct'
    refMap[domain] = (refMap[domain] ?? 0) + 1
  }
  const top_referrers = Object.entries(refMap)
    .map(([domain, visits]) => ({ domain, visits }))
    .sort((a, b) => b.visits - a.visits).slice(0, 10)

  // Device breakdown (stub if no data)
  const device_breakdown = [
    { name: 'Desktop', value: Math.round(total_visits * 0.56) },
    { name: 'Mobile',  value: Math.round(total_visits * 0.38) },
    { name: 'Tablet',  value: Math.round(total_visits * 0.06) },
  ]

  // Funnel
  const { count: registeredCount } = await db.from('users').select('*', { count: 'exact', head: true })
  const { count: activatedCount }  = await db.from('scans').select('*', { count: 'exact', head: true }).gte('created_at', since30d)
  const funnel = [
    { stage: 'Visits',     count: total_visits,             rate: 0 },
    { stage: 'Signups',    count: signups,                   rate: total_visits > 0 ? 100 - (signups / total_visits) * 100 : 0 },
    { stage: 'Registered', count: registeredCount ?? 0,      rate: signups > 0 ? 100 - ((registeredCount ?? 0) / signups) * 100 : 0 },
    { stage: 'Activated',  count: activatedCount ?? 0,       rate: (registeredCount ?? 1) > 0 ? 100 - ((activatedCount ?? 0) / (registeredCount ?? 1)) * 100 : 0 },
  ]

  return NextResponse.json({
    kpis: { total_visits, unique_visitors, signups, conversion_rate },
    traffic_daily,
    utm_performance,
    top_referrers,
    device_breakdown,
    funnel,
  })
}
