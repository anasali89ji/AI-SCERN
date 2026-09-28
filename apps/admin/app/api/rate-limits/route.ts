import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '24h'
  const hours = period === '1h' ? 1 : period === '24h' ? 24 : 168
  const since = new Date(Date.now() - hours * 3600000).toISOString()

  const db = getAdminDb()
  const { data, error } = await db
    .from('rate_limit_events')
    .select('*')
    .gte('created_at', since)
    .order('count', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const aggregated: Record<string, any> = {}
  for (const row of data || []) {
    if (!aggregated[row.ip_address]) {
      aggregated[row.ip_address] = { ip_address: row.ip_address, endpoint: row.endpoint, count: 0, last_at: row.last_at }
    }
    aggregated[row.ip_address].count += row.count || 1
  }

  return NextResponse.json({
    aggregated: Object.values(aggregated),
    total: data?.length || 0,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { ip, reason } = await req.json()
  if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 })

  const db = getAdminDb()
  const { error } = await db.from('blocked_domains').insert({ 
    domain: ip, 
    reason: reason || 'Manual block from admin panel', 
    blocked_by: auth.adminId 
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'ip_blocked',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { ip, reason },
  })

  return NextResponse.json({ ok: true })
}
