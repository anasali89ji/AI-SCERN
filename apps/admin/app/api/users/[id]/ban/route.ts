import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req, 'users:write')
  if (auth instanceof NextResponse) return auth

  const { ban, reason } = await req.json()
  const db = getAdminDb()

  const { error } = await db
    .from('profiles')
    .update({ is_banned: !!ban, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: ban ? 'user_banned' : 'user_unbanned',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { user_id: params.id, reason: reason || null },
  })

  return NextResponse.json({ ok: true, banned: !!ban })
}
