/**
 * GET/POST /api/admin/maintenance
 *
 * Root cause of "maintenance mode doesn't apply": /api/maintenance/route.ts
 * (the public status endpoint middleware.ts and the maintenance page read
 * from) only ever had a GET handler. There was no POST/PATCH anywhere in
 * the codebase that wrote maintenance_enabled to site_settings, and no
 * admin UI wired up to call one — grep for "site_settings" turned up
 * exactly two files (middleware.ts, the old read-only route), both
 * read-only. Whatever the admin panel's maintenance control was doing, it
 * wasn't reaching the database, so the site never actually saw
 * maintenance_enabled flip to 'true' — hence it "doesn't apply" anywhere.
 *
 * This route is the missing write path, admin-gated via verifyAdmin()
 * (same pattern as every other /api/admin/* route). The admin UI at
 * /admin now calls this instead of nothing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAdminError } from '@/lib/auth/verify-admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('site_settings')
    .select('key, value')
    .in('key', ['maintenance_enabled', 'maintenance_message', 'maintenance_duration', 'maintenance_allowed_ips'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settings: Record<string, string> = {}
  for (const row of data || []) settings[row.key] = row.value

  let allowed_ips: string[] = []
  try {
    allowed_ips = JSON.parse(settings.maintenance_allowed_ips || '[]')
  } catch { /* ignore */ }

  return NextResponse.json({
    enabled:  settings.maintenance_enabled === 'true',
    message:  settings.maintenance_message || '',
    duration: settings.maintenance_duration || '',
    allowed_ips,
  })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  let body: { enabled?: boolean; message?: string; duration?: string; allowed_ips?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '"enabled" (boolean) is required' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  const rows: { key: string; value: string }[] = [
    { key: 'maintenance_enabled', value: String(body.enabled) },
  ]
  if (typeof body.message === 'string') rows.push({ key: 'maintenance_message', value: body.message })
  if (typeof body.duration === 'string') rows.push({ key: 'maintenance_duration', value: body.duration })
  if (Array.isArray(body.allowed_ips)) rows.push({ key: 'maintenance_allowed_ips', value: JSON.stringify(body.allowed_ips) })

  const { error } = await db.from('site_settings').upsert(rows, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[MAINTENANCE] ${body.enabled ? 'ENABLED' : 'DISABLED'} by admin ${admin.userId}`)

  return NextResponse.json({ ok: true, enabled: body.enabled })
}
