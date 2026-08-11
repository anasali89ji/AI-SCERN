import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const KEYS = ['maintenance_enabled', 'maintenance_message', 'maintenance_duration', 'maintenance_allowed_ips']

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db.from('site_settings').select('key, value').in('key', KEYS)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settings: Record<string, any> = { 
    enabled: false, 
    message: '', 
    estimated_duration: '', 
    allowed_ips: [] 
  }

  for (const row of data || []) {
    if (row.key === 'maintenance_allowed_ips') {
      try { 
        settings.allowed_ips = JSON.parse(row.value || '[]') 
      } catch { 
        settings.allowed_ips = [] 
      }
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

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { enabled, message, estimated_duration, allowed_ips } = body
  const db = getAdminDb()

  if (message && message.length > 500) {
    return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 })
  }

  const ipList = Array.isArray(allowed_ips) ? allowed_ips : []
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const validIPs = ipList.filter(ip => ipRegex.test(ip) || ip === '127.0.0.1' || ip === '::1')

  const updates = [
    { key: 'maintenance_enabled', value: String(!!enabled) },
    { key: 'maintenance_message', value: (message || '').slice(0, 500) },
    { key: 'maintenance_duration', value: (estimated_duration || '').slice(0, 100) },
    { key: 'maintenance_allowed_ips', value: JSON.stringify(validIPs) },
  ]

  for (const u of updates) {
    const { error } = await db.from('site_settings').upsert({ 
      key: u.key, 
      value: u.value, 
      updated_at: new Date().toISOString() 
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('admin_audit_log').insert({
    action: enabled ? 'maintenance_enabled' : 'maintenance_disabled',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { enabled, message, estimated_duration, allowed_ips: validIPs },
  })

  return NextResponse.json({ 
    ok: true, 
    enabled: !!enabled,
    message: 'Maintenance settings updated successfully' 
  })
}
