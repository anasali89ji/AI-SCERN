import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req, 'users:write')
  if (auth instanceof NextResponse) return auth

  const { plan, reason = 'admin_change' } = await req.json()
  if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

  const db = getAdminDb()
  const { error } = await db.from('profiles').update({ 
    plan, 
    plan_id: plan,
    plan_updated_at: new Date().toISOString(),
    plan_granted_by: auth.adminId,
    updated_at: new Date().toISOString()
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'plan_changed',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { user_id: params.id, plan, reason },
  })

  return NextResponse.json({ ok: true, plan })
}
