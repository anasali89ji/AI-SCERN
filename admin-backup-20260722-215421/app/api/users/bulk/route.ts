import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'users:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as {
    action: 'ban' | 'unban' | 'delete' | 'credits' | 'plan'
    userIds: string[]
    reason?: string
    delta?: number
    plan?: string
  }

  if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
    return NextResponse.json({ error: 'userIds array required' }, { status: 400 })
  }

  const db = getAdminDb()
  const results: Record<string, { success: boolean; error?: string }> = {}

  for (const userId of body.userIds) {
    try {
      switch (body.action) {
        case 'ban':
          await db.from('profiles').update({ is_banned: true }).eq('id', userId)
          break
        case 'unban':
          await db.from('profiles').update({ is_banned: false }).eq('id', userId)
          break
        case 'delete':
          await db.from('profiles').delete().eq('id', userId)
          break
        case 'credits':
          if (body.delta === undefined) throw new Error('delta required')
          const { data: profile } = await db.from('profiles').select('credits_balance').eq('id', userId).single()
          const newBalance = Math.max(0, (profile?.credits_balance ?? 0) + body.delta)
          await db.from('profiles').update({ credits_balance: newBalance, credits_remaining: newBalance }).eq('id', userId)
          await db.from('credit_transactions').insert({
            user_id: userId,
            transaction_type: 'admin_bulk_grant',
            credits: body.delta,
            status: 'completed',
            metadata: { admin_ip: auth.ip, reason: body.reason, bulk: true },
          })
          break
        case 'plan':
          if (!body.plan) throw new Error('plan required')
          await db.from('profiles').update({ plan: body.plan, plan_id: body.plan }).eq('id', userId)
          break
      }
      results[userId] = { success: true }
    } catch (e: any) {
      results[userId] = { success: false, error: e.message }
    }
  }

  const successCount = Object.values(results).filter(r => r.success).length
  const failedCount = body.userIds.length - successCount

  await logAdminAction(`users_bulk_${body.action}`, null, auth.ip, {
    count: body.userIds.length,
    success: successCount,
    failed: failedCount,
    reason: body.reason,
  }, auth.adminId)

  return NextResponse.json({
    ok: true,
    processed: body.userIds.length,
    success: successCount,
    failed: failedCount,
    results,
  })
}
