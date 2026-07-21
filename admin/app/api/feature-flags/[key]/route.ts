import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ key: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'flags:write')
  if (auth instanceof NextResponse) return auth
  const { key } = await params

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db
    .from('feature_flags')
    .update({ ...body, updated_at: new Date().toISOString(), updated_by: auth.adminId })
    .eq('key', key)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('flag_updated', data.id as string, auth.ip, { key, ...body }, auth.adminId)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'flags:write')
  if (auth instanceof NextResponse) return auth
  const { key } = await params

  const db = getAdminDb()
  const { error } = await db.from('feature_flags').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('flag_deleted', null, auth.ip, { key }, auth.adminId)
  return NextResponse.json({ ok: true })
}
