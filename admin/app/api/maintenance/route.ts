import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const KEYS = ['maintenance_enabled', 'maintenance_message', 'maintenance_duration', 'maintenance_allowed_ips']

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data } = await db.from('site_settings').select('key, value').in('key', KEYS)

  const settings: Record<string, any> = { enabled: false, message: '', estimated_duration: '', allowed_ips: [] }
  for (const row of data || []) {
    if (row.key === 'maintenance_allowed_ips') {
      try { settings.allowed_ips = JSON.parse(row.value || '[]') } catch { settings.allowed_ips = [] }
    } else if (row.key === 'maintenance_enabled') {
      settings.enabled = row.value === 'true'
    } else if (row.key === 'maintenance_message') {
      settings.message = row.value || ''
    } else if (row.key === 'maintenance_duration') {
      settings.estimated_duration = row.value || ''
    }
  }

  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { enabled, message, estimated_duration, allowed_ips } = await req.json()
  const db = getAdminDb()

  const updates = [
    { key: 'maintenance_enabled', value: String(!!enabled) },
    { key: 'maintenance_message', value: message || '' },
    { key: 'maintenance_duration', value: estimated_duration || '' },
    { key: 'maintenance_allowed_ips', value: JSON.stringify(allowed_ips || []) },
  ]

  for (const u of updates) {
    const { error } = await db.from('site_settings').upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('admin_audit_log').insert({
    action: 'maintenance_updated',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { enabled, message },
  })

  return NextResponse.json({ ok: true })
}
