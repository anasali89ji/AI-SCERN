import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data } = await getAdminDb().from('feature_flags').select('*').order('key')
  return NextResponse.json({ flags: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json()
  const { key, enabled = false, rollout_percentage = 100, description = '' } = body
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
  const { error } = await getAdminDb().from('feature_flags').insert({ key, enabled, rollout_percentage, description })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logAdminAction('flag_create', null, (auth as any).ip, { key })
  return NextResponse.json({ ok: true })
}
