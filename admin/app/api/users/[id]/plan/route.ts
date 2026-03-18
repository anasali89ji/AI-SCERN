import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const PLAN_CREDITS: Record<string, number> = { free: 5, starter: 100, pro: 500, enterprise: -1 }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { planId } = await req.json()
  if (!['free','starter','pro','enterprise'].includes(planId)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const db = getAdminDb()
  const { error } = await db.from('profiles').update({
    plan_id: planId, plan: planId,
    subscription_status: planId === 'free' ? 'free' : 'active',
    credits_remaining: PLAN_CREDITS[planId] ?? 5,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('plan_change', id, auth.ip, { planId })
  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
