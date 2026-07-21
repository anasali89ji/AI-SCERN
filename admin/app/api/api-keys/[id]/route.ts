import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'apikeys:write')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db
    .from('api_keys')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('apikey_updated', id, auth.ip, body, auth.adminId)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'apikeys:write')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const db = getAdminDb()
  const { error } = await db.from('api_keys').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('apikey_deleted', id, auth.ip, {}, auth.adminId)
  return NextResponse.json({ ok: true })
}
