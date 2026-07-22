import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  const [
    blockedDomains,
    rateLimitEvents,
    auditLogs,
    failedLogins
  ] = await Promise.all([
    db.from('blocked_domains').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('rate_limit_events').select('*').order('count', { ascending: false }).limit(50),
    db.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('admin_audit_log').select('*').eq('action', 'login_failed').order('created_at', { ascending: false }).limit(20),
  ])

  return NextResponse.json({
    blockedDomains: blockedDomains.data || [],
    rateLimitEvents: rateLimitEvents.data || [],
    auditLogs: auditLogs.data || [],
    failedLogins: failedLogins.data || [],
  })
}
