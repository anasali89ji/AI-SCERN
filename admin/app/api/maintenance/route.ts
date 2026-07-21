import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction, checkMaintenanceMode } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'maintenance:read')
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data: settings } = await db.from('settings').select('key, value')

  const maintenance = {
    enabled: false,
    message: 'We are performing scheduled maintenance. Please check back soon.',
    allowed_ips: [] as string[],
    estimated_duration: '',
  }

  for (const s of settings ?? []) {
    if (s.key === 'maintenance_mode') maintenance.enabled = s.value === 'true'
    if (s.key === 'maintenance_message') maintenance.message = s.value
    if (s.key === 'maintenance_allowed_ips') {
      try { maintenance.allowed_ips = JSON.parse(s.value) } catch {}
    }
    if (s.key === 'maintenance_duration') maintenance.estimated_duration = s.value
  }

  return NextResponse.json(maintenance)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'maintenance:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const updates: { key: string; value: string }[] = []
  if (body.enabled !== undefined) updates.push({ key: 'maintenance_mode', value: String(body.enabled) })
  if (body.message !== undefined) updates.push({ key: 'maintenance_message', value: body.message })
  if (body.allowed_ips !== undefined) updates.push({ key: 'maintenance_allowed_ips', value: JSON.stringify(body.allowed_ips) })
  if (body.estimated_duration !== undefined) updates.push({ key: 'maintenance_duration', value: body.estimated_duration })

  for (const u of updates) {
    await db.from('settings').upsert(u, { onConflict: 'key' })
  }

  await logAdminAction('maintenance_updated', null, auth.ip, body, auth.adminId)
  return NextResponse.json({ ok: true, maintenance: body })
}
