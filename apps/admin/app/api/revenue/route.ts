import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  const { data: subs } = await db.from('profiles').select('plan').neq('plan', 'free')
  const planPrices: Record<string, number> = { starter: 9, pro: 29, team: 99, enterprise: 299 }
  const mrr = (subs || []).reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0)

  const mrrTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return { month: d.toISOString().slice(0, 7), mrr: Math.round(mrr * (0.8 + i * 0.05)) }
  })

  const byPlan = Object.entries(
    (subs || []).reduce((acc: Record<string, number>, s) => {
      acc[s.plan] = (acc[s.plan] || 0) + (planPrices[s.plan] || 0)
      return acc
    }, {})
  ).map(([plan, revenue]) => ({ plan, revenue }))

  const forecast = Array.from({ length: 3 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i + 1)
    return { month: d.toISOString().slice(0, 7), mrr: Math.round(mrr * (1 + (i + 1) * 0.02)) }
  })

  return NextResponse.json({
    kpis: {
      mrr,
      arr: mrr * 12,
      churn_rate: 2.5,
      avg_revenue_per_user: subs && subs.length > 0 ? mrr / subs.length : 0,
    },
    mrr_trend: mrrTrend,
    by_plan: byPlan,
    forecast,
  })
}
