import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const db    = getAdminDb()
  const since = new Date(Date.now() - 24*60*60*1000).toISOString()
  const [events, errors, blocked] = await Promise.all([
    db.from('security_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(50),
    db.from('error_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(50),
    db.from('blocked_domains').select('*').order('created_at', { ascending: false }).limit(20),
  ])
  return NextResponse.json({
    ok: true,
    summary: {
      total_events:     events.data?.length ?? 0,
      critical_events:  events.data?.filter((e:any) => e.severity === 'critical').length ?? 0,
      total_errors:     errors.data?.length ?? 0,
      unresolved_errors:errors.data?.filter((e:any) => !e.resolved).length ?? 0,
      blocked_domains:  blocked.data?.length ?? 0,
    },
    events: events.data ?? [],
    errors: errors.data ?? [],
    blocked_domains: blocked.data ?? [],
  })
}
