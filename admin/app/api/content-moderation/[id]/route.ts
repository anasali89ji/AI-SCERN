import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { status, resolution } = await req.json()
  const db = getAdminDb()

  const { error } = await db.from('content_flags').update({
    status: status || 'reviewed',
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'content_moderated',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { flag_id: params.id, status, resolution: resolution || null },
  })

  return NextResponse.json({ ok: true })
}
