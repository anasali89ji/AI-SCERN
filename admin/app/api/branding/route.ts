import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const BRANDING_KEYS = [
  'site_name', 'site_tagline', 'primary_color', 'secondary_color',
  'logo_url', 'favicon_url', 'email_from_name', 'email_from_address',
  'support_email', 'social_twitter', 'social_discord', 'social_github',
  'footer_text', 'custom_css'
]

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data } = await db.from('site_settings').select('key, value').in('key', BRANDING_KEYS)

  const settings: Record<string, string> = {}
  for (const row of data || []) settings[row.key] = row.value || ''
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  for (const [key, value] of Object.entries(body)) {
    if (!BRANDING_KEYS.includes(key)) continue
    const { error } = await db.from('site_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('admin_audit_log').insert({
    action: 'branding_updated',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { keys: Object.keys(body) },
  })

  return NextResponse.json({ ok: true })
}
