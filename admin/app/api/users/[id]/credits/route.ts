import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { delta, reason } = await req.json()
  if (!delta || typeof delta !== 'number') return NextResponse.json({ error: 'delta required' }, { status: 400 })

  const db = getAdminDb()
  const { data, error } = await db.rpc('admin_grant_credits', {
    p_user_id: params.id,
    p_delta: delta,
    p_reason: reason || 'admin_grant',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('credit_grant', params.id, auth.ip, { delta, reason })
  return NextResponse.json(data)
}
