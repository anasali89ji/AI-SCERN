import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'rate_limits:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '24h'
  const hours = period === '1h' ? 1 : period === '7d' ? 168 : 24

  const db = getAdminDb()
  const since = new Date(Date.now() - hours * 3600000).toISOString()

  // Get rate limit events
  const { data: events, error } = await db
    .from('rate_limit_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by IP
  const ipMap: Record<string, { count: number; endpoints: Set<string>; lastAt: string }> = {}
  for (const ev of events ?? []) {
    const ip = ev.ip_address || 'unknown'
    if (!ipMap[ip]) ipMap[ip] = { count: 0, endpoints: new Set(), lastAt: ev.created_at }
    ipMap[ip].count++
    ipMap[ip].endpoints.add(ev.endpoint || 'unknown')
    if (new Date(ev.created_at) > new Date(ipMap[ip].lastAt)) {
      ipMap[ip].lastAt = ev.created_at
    }
  }

  const aggregated = Object.entries(ipMap)
    .map(([ip, stats]) => ({
      ip,
      count: stats.count,
      endpoints: Array.from(stats.endpoints),
      lastAt: stats.lastAt,
    }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    events: events ?? [],
    aggregated,
    period,
    total: (events ?? []).length,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'security:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db.from('blocked_ips').upsert({
    ip_address: body.ip,
    reason: body.reason || 'Manual block by admin',
    blocked_by: auth.adminId,
    expires_at: body.expires_at || null,
  }, { onConflict: 'ip_address' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
