import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const DEFAULT_BRANDING = {
  site_name: 'Aiscern',
  site_tagline: 'AI Detection Platform',
  primary_color: '#2563eb',
  secondary_color: '#1d4ed8',
  logo_url: '/logo.png',
  favicon_url: '/favicon.ico',
  custom_css: '',
  email_from_name: 'Aiscern',
  email_from_address: 'noreply@aiscern.com',
  support_email: 'support@aiscern.com',
  social_twitter: '',
  social_discord: '',
  social_github: '',
  footer_text: '© 2026 Aiscern. All rights reserved.',
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'branding:read')
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data } = await db.from('branding').select('key, value')

  if (!data || data.length === 0) return NextResponse.json(DEFAULT_BRANDING)

  const merged = { ...DEFAULT_BRANDING }
  for (const row of data) {
    merged[row.key as keyof typeof merged] = row.value as any
  }

  return NextResponse.json(merged)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'branding:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const upserts = Object.entries(body).map(([key, value]) =>
    db.from('branding').upsert({ key, value: String(value) }, { onConflict: 'key' })
  )
  await Promise.all(upserts)

  await logAdminAction('branding_updated', null, auth.ip, body, auth.adminId)
  return NextResponse.json({ ok: true })
}
