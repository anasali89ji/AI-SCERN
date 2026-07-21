import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const TABLES_TO_BACKUP = [
  'profiles', 'scans', 'credit_transactions', 'subscriptions',
  'support_tickets', 'announcements', 'notifications', 'admin_audit_log',
  'error_logs', 'security_events', 'feature_flags', 'settings',
  'api_keys', 'webhooks', 'content_flags', 'blocked_domains',
]

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'backup:read')
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  // List existing backups
  const { data: backups, error } = await db
    .from('backups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ backups: backups ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'backup:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as { tables?: string[]; name?: string }
  const tables = body.tables || TABLES_TO_BACKUP
  const db = getAdminDb()

  const backupData: Record<string, unknown[]> = {}
  let totalRows = 0

  for (const table of tables) {
    try {
      const { data, error } = await db.from(table).select('*').limit(10000)
      if (!error && data) {
        backupData[table] = data
        totalRows += data.length
      }
    } catch (e) {
      console.error(`[backup] Failed to backup ${table}:`, e)
    }
  }

  const backupRecord = {
    name: body.name || `Backup ${new Date().toISOString()}`,
    tables: Object.keys(backupData),
    total_rows: totalRows,
    data: backupData,
    created_by: auth.adminId,
  }

  const { data, error } = await db.from('backups').insert(backupRecord).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('backup_created', data.id as string, auth.ip, {
    tables: Object.keys(backupData),
    totalRows,
  }, auth.adminId)

  return NextResponse.json({
    ok: true,
    backup: data,
    tablesBackedUp: Object.keys(backupData),
    totalRows,
  }, { status: 201 })
}
