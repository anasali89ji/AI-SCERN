import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const TABLES = ['profiles', 'scans', 'credit_transactions', 'support_tickets', 'error_logs', 'admin_audit_log', 'api_keys', 'content_flags', 'webhooks', 'feature_flags', 'announcements', 'admin_users', 'site_settings', 'rate_limit_events', 'backups', 'marketing_analytics', 'pipeline_stats', 'pipeline_costs', 'fallback_flags']

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db.from('backups').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ backups: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { name } = await req.json()
  const db = getAdminDb()

  let totalRows = 0
  for (const table of TABLES) {
    try {
      const { count } = await db.from(table).select('*', { count: 'exact', head: true })
      totalRows += count || 0
    } catch { /* table may not exist yet */ }
  }

  const { error } = await db.from('backups').insert({
    name: name || `Backup ${new Date().toISOString()}`,
    tables: TABLES,
    total_rows: totalRows,
    created_by: auth.adminId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, totalRows })
}
