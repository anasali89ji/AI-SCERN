import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const SETTING_KEYS = [
  'maintenance_mode', 'registration_open', 'free_scans_limit', 'pro_scans_limit',
  'max_file_size_mb', 'support_email', 'default_plan', 'referral_credits',
  'data_retention_days', 'enable_ai_chat', 'enable_image_detection',
  'enable_audio_detection', 'enable_video_detection', 'require_email_verification'
]

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data } = await db.from('site_settings').select('key, value').in('key', SETTING_KEYS)

  const settings: Record<string, any> = {}
  for (const row of data || []) {
    const val = row.value
    if (val === 'true') settings[row.key] = true
    else if (val === 'false') settings[row.key] = false
    else if (!isNaN(Number(val)) && val !== '') settings[row.key] = Number(val)
    else settings[row.key] = val
  }
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  for (const [key, value] of Object.entries(body)) {
    if (!SETTING_KEYS.includes(key)) continue
    const { error } = await db.from('site_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('admin_audit_log').insert({
    action: 'settings_updated',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { keys: Object.keys(body) },
  })

  return NextResponse.json({ ok: true })
}
