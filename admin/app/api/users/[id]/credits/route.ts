import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { delta, reason } = await req.json()
  if (!delta || typeof delta !== 'number') return NextResponse.json({ error: 'delta required' }, { status: 400 })

  const db = getAdminDb()
  const { data, error } = await db.rpc('admin_grant_credits', {
    p_user_id: id,
    p_delta: delta,
    p_reason: reason || 'admin_grant',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('credit_grant', id, auth.ip, { delta, reason })
  return NextResponse.json(data)
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
