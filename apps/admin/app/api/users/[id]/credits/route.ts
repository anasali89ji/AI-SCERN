import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req, 'users:write')
  if (auth instanceof NextResponse) return auth

  const { delta, reason = 'admin_adjustment' } = await req.json()
  if (typeof delta !== 'number') return NextResponse.json({ error: 'delta (number) required' }, { status: 400 })

  const db = getAdminDb()

  const { data: profile } = await db.from('profiles').select('credits_balance, credits_remaining, email, display_name').eq('id', params.id).single()
  const current = profile?.credits_balance ?? 0
  const newBalance = Math.max(0, current + delta)

  const { error } = await db.from('profiles').update({ 
    credits_balance: newBalance,
    credits_remaining: newBalance,
    updated_at: new Date().toISOString()
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('credit_transactions').insert({
    user_id: params.id,
    delta,
    credits: newBalance,
    reason,
  })

  await db.from('admin_audit_log').insert({
    action: 'credits_adjusted',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { user_id: params.id, delta, new_balance: newBalance, reason },
  })

  return NextResponse.json({ ok: true, newBalance, previousBalance: current })
}
