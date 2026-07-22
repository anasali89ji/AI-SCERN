import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'flags:read')
  if (auth instanceof NextResponse) return auth

  const { data, error } = await getAdminDb()
    .from('feature_flags')
    .select('*')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'flags:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  const { key, name, description, enabled = false, rollout_percentage = 100, target_audience = 'all' } = body
  if (!key || !name) return NextResponse.json({ error: 'key and name are required' }, { status: 400 })

  const { data, error } = await getAdminDb()
    .from('feature_flags')
    .insert({ key, name, description, enabled, rollout_percentage, target_audience, created_by: auth.adminId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logAdminAction('flag_created', data.id as string, auth.ip, { key }, auth.adminId)
  return NextResponse.json(data, { status: 201 })
}
