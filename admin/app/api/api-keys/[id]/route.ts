import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { error } = await db.from('api_keys').update({
    ...body,
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { error } = await db.from('api_keys').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'api_key_deleted',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { key_id: params.id },
  })

  return NextResponse.json({ ok: true })
}
