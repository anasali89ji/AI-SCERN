import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data } = await getAdminDb().from('platform_settings').select('*').order('key')
  return NextResponse.json({ ok: true, settings: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { key, value } = await req.json()
  if (!key || value === undefined) return NextResponse.json({ error: 'key and value required' }, { status: 400 })
  await getAdminDb().from('platform_settings').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() })
  await logAdminAction(`setting_update:${key}`, null, (auth as {ip:string}).ip, { key, value })
  return NextResponse.json({ ok: true })
}
