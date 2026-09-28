import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'users:write')
  if (auth instanceof NextResponse) return auth

  const { action, userIds, delta, plan } = await req.json()
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'userIds array required' }, { status: 400 })
  }

  const db = getAdminDb()
  const results = { success: 0, failed: 0, errors: [] as string[] }

  for (const userId of userIds) {
    try {
      if (action === 'ban') {
        await db.from('profiles').update({ is_banned: true, updated_at: new Date().toISOString() }).eq('id', userId)
      } else if (action === 'unban') {
        await db.from('profiles').update({ is_banned: false, updated_at: new Date().toISOString() }).eq('id', userId)
      } else if (action === 'delete') {
        await db.from('profiles').delete().eq('id', userId)
      } else if (action === 'plan' && plan) {
        await db.from('profiles').update({ plan, plan_id: plan, plan_updated_at: new Date().toISOString() }).eq('id', userId)
      } else if (action === 'credits' && typeof delta === 'number') {
        const { data: p } = await db.from('profiles').select('credits_balance').eq('id', userId).single()
        const newBal = Math.max(0, (p?.credits_balance ?? 0) + delta)
        await db.from('profiles').update({ credits_balance: newBal, credits_remaining: newBal, updated_at: new Date().toISOString() }).eq('id', userId)
        await db.from('credit_transactions').insert({ user_id: userId, delta, credits: newBal, reason: 'admin_bulk' })
      }
      results.success++
    } catch (e: any) {
      results.failed++
      results.errors.push(`${userId}: ${e.message}`)
    }
  }

  await db.from('admin_audit_log').insert({
    action: `bulk_${action}`,
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { count: userIds.length, action, success: results.success, failed: results.failed },
  })

  return NextResponse.json(results)
}
