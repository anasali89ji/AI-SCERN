import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req, 'security:read')
    if (auth instanceof NextResponse) return auth

    const db = getAdminDb()
    const since = new Date(Date.now() - 24*60*60*1000).toISOString()
    const weekSince = new Date(Date.now() - 7*24*60*60*1000).toISOString()

    const [events, errors, blocked, blockedIps, loginAttempts, suspicious] = await Promise.all([
      db.from('security_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(50),
      db.from('error_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(50),
      db.from('blocked_domains').select('*').order('created_at', { ascending: false }).limit(20),
      db.from('blocked_ips').select('*').order('created_at', { ascending: false }).limit(20),
      db.from('admin_audit_log').select('*').eq('action', 'login_failed').gte('created_at', weekSince).order('created_at', { ascending: false }).limit(50),
      db.from('security_events').select('*').eq('severity', 'critical').gte('created_at', weekSince).order('created_at', { ascending: false }).limit(20),
    ])

    return NextResponse.json({
      ok: true,
      summary: {
        total_events: events.data?.length ?? 0,
        critical_events: events.data?.filter((e: any) => e.severity === 'critical').length ?? 0,
        total_errors: errors.data?.length ?? 0,
        unresolved_errors: errors.data?.filter((e: any) => !e.resolved).length ?? 0,
        blocked_domains: blocked.data?.length ?? 0,
        blocked_ips: blockedIps.data?.length ?? 0,
        failed_logins_7d: loginAttempts.data?.length ?? 0,
        suspicious_activity: suspicious.data?.length ?? 0,
      },
      events: events.data ?? [],
      errors: errors.data ?? [],
      blocked_domains: blocked.data ?? [],
      blocked_ips: blockedIps.data ?? [],
      failed_logins: loginAttempts.data ?? [],
      suspicious_activity: suspicious.data ?? [],
    })
  } catch (err: any) {
    console.error("[Admin security]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
