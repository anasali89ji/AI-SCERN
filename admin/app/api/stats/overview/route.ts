import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [users, scansToday, subscriptions, creditTx] = await Promise.allSettled([
    db.from('profiles').select('id, plan_id, created_at, is_banned', { count: 'exact' }),
    db.from('scans').select('id, media_type, verdict', { count: 'exact' }).gte('created_at', today.toISOString()),
    db.from('profiles').select('plan_id').neq('subscription_status', 'free').neq('plan_id', 'free'),
    db.from('credit_transactions').select('delta').eq('reason', 'monthly_reset').gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString()),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { data: [], count: 0, error: null }))

  const planCounts = (subscriptions.data || []).reduce((acc: Record<string,number>, p) => {
    acc[p.plan_id] = (acc[p.plan_id] || 0) + 1; return acc
  }, {})

  const typeDist = (scansToday.data || []).reduce((acc: Record<string,number>, s) => {
    acc[s.media_type] = (acc[s.media_type] || 0) + 1; return acc
  }, {})

  return NextResponse.json({
    totalUsers: users.count || 0,
    scansToday: scansToday.count || 0,
    activeSubscriptions: Object.values(planCounts).reduce((a: number, b: unknown) => a + (b as number), 0),
    planDistribution: planCounts,
    scanTypeDistribution: typeDist,
    bannedUsers: (users.data || []).filter(u => u.is_banned).length,
  })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
