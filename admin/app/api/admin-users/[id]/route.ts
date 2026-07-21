import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super_admin can modify admin users' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const db = getAdminDb()

  const updateData: Record<string, unknown> = {}
  if (body.name) updateData.name = body.name
  if (body.role) updateData.role = body.role
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  if (body.password) updateData.password_hash = await bcrypt.hash(body.password, 12)

  const { data, error } = await db
    .from('admin_users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('admin_user_updated', id, auth.ip, body, auth.adminId)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super_admin can delete admin users' }, { status: 403 })
  }
  const { id } = await params

  // Prevent self-deletion
  if (id === auth.adminId) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  const db = getAdminDb()
  const { error } = await db.from('admin_users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('admin_user_deleted', id, auth.ip, {}, auth.adminId)
  return NextResponse.json({ ok: true })
}
