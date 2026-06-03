import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

// Default settings — returned if the DB row doesn't exist yet
const DEFAULTS = {
  maintenance_mode:    false,
  registration_open:   true,
  free_scans_limit:    10,
  pro_scans_limit:     500,
  team_scans_limit:    2000,
  max_file_size_mb:    10,
  support_email:       'support@aiscern.com',
  site_announcement:   '',
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  // Flat key-value store pattern
  const { data } = await db.from('settings').select('key, value')
  if (!data || data.length === 0) return NextResponse.json(DEFAULTS)

  // Merge DB values over defaults
  const merged: Record<string, unknown> = { ...DEFAULTS }
  for (const row of data) {
    const k = row.key as string
    const v = row.value as unknown
    if (k in merged) {
      // Coerce booleans stored as strings
      if (typeof DEFAULTS[k as keyof typeof DEFAULTS] === 'boolean') {
        merged[k] = v === true || v === 'true' || v === 1
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
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = getAdminDb()

  // Upsert each key
  const upserts = Object.entries(body).map(([key, value]) =>
    db.from('settings').upsert({ key, value }, { onConflict: 'key' })
  )
  await Promise.all(upserts)

  await logAdminAction('settings_changed', null, auth.ip, body)
  return NextResponse.json({ ok: true })
}
