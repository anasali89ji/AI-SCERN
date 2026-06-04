import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ key: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { key } = await params
  const body = await req.json() as Record<string, unknown>
  const { data, error } = await getAdminDb()
    .from('feature_flags')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('flag_toggled', key, auth.ip, body)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { key } = await params
  const { error } = await getAdminDb().from('feature_flags').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('flag_deleted', key, auth.ip)
  return NextResponse.json({ ok: true })
}
