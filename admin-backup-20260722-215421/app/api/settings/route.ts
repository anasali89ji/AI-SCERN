import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  maintenance_mode: false,
  registration_open: true,
  free_scans_limit: 10,
  pro_scans_limit: 500,
  team_scans_limit: 2000,
  enterprise_scans_limit: -1,
  max_file_size_mb: 10,
  max_video_duration_sec: 300,
  support_email: 'support@aiscern.com',
  site_announcement: '',
  enable_ai_chat: true,
  enable_image_detection: true,
  enable_audio_detection: true,
  enable_video_detection: true,
  enable_text_detection: true,
  require_email_verification: false,
  default_plan: 'free',
  referral_credits: 50,
  auto_ban_threshold: 100,
  scan_cooldown_seconds: 0,
  enable_webhooks: true,
  enable_realtime_notifications: true,
  data_retention_days: 90,
  analytics_enabled: true,
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'settings:read')
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data } = await db.from('settings').select('key, value')

  if (!data || data.length === 0) return NextResponse.json(DEFAULTS)

  const merged: Record<string, unknown> = { ...DEFAULTS }
  for (const row of data) {
    const k = row.key as string
    const v = row.value as unknown
    if (k in merged) {
      if (typeof DEFAULTS[k as keyof typeof DEFAULTS] === 'boolean') {
        merged[k] = v === true || v === 'true' || v === 1 || v === '1'
      } else if (typeof DEFAULTS[k as keyof typeof DEFAULTS] === 'number') {
        merged[k] = Number(v) || 0
      } else {
        merged[k] = v
      }
    }
  }

  return NextResponse.json(merged)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'settings:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = getAdminDb()
  const upserts = Object.entries(body).map(([key, value]) =>
    db.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' })
  )
  await Promise.all(upserts)

  await logAdminAction('settings_changed', null, auth.ip, body, auth.adminId)
  return NextResponse.json({ ok: true })
}
