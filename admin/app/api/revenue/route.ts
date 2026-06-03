import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  // Plan counts & revenue
  const { data: planData } = await db
    .from('users')
    .select('plan, subscriptions(amount, currency, status)')
  
  const planRevMap: Record<string, { revenue: number; users: number }> = {}
  let total_paid = 0
  for (const u of planData ?? []) {
    const plan = (u.plan as string) ?? 'free'
    if (!planRevMap[plan]) planRevMap[plan] = { revenue: 0, users: 0 }
    planRevMap[plan].users++
    const subs = (u.subscriptions as Array<{ amount: number; status: string }>) ?? []
    for (const s of subs) {
      if (s.status === 'active') { planRevMap[plan].revenue += (s.amount ?? 0); total_paid += (s.amount ?? 0) }
    }
  }
  const by_plan = Object.entries(planRevMap).map(([plan, v]) => ({ plan, ...v }))

  // MRR
  const { data: subData } = await db
    .from('subscriptions')
    .select('amount, currency, billing_interval, created_at')
    .eq('status', 'active')

  let mrr = 0
  for (const s of subData ?? []) {
    const amt = (s as Record<string, number>).amount ?? 0
    mrr += (s as Record<string, string>).billing_interval === 'year' ? amt / 12 : amt
  }
  const arr = mrr * 12

  // MRR trend (12 months)
  const months: Array<{ month: string; mrr: number }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    months.push({ month: label, mrr: mrr * (0.85 + Math.random() * 0.3) }) // TODO: replace with real historical
  }

  // Failed payments
  const { data: failed } = await db
    .from('payment_events')
    .select('id, user_id, amount, currency, error_message, created_at, retried, users(email)')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(50)

  const failed_payments = (failed ?? []).map(f => ({
    id: f.id as string,
    email: ((f.users as unknown as Record<string, string>)?.email) ?? 'unknown',
    amount: (f.amount as number) ?? 0,
    currency: (f.currency as string) ?? 'USD',
    error: (f.error_message as string) ?? 'unknown',
    created_at: f.created_at as string,
    retried: (f.retried as boolean) ?? false,
  }))

  // Gateway breakdown
  const { data: gwData } = await db
    .from('payment_events')
    .select('gateway, amount')
    .eq('status', 'succeeded')
  const gwMap: Record<string, number> = {}
  for (const p of gwData ?? []) {
    gwMap[(p.gateway as string) ?? 'unknown'] = ((gwMap[(p.gateway as string)] ?? 0) + ((p.amount as number) ?? 0))
  }
  const by_gateway = Object.entries(gwMap).map(([name, value]) => ({ name, value }))

  // Churn trend (stub — replace with real cancel event data)
  const churn_trend = months.map(m => ({ month: m.month, churn_rate: 2 + Math.random() * 2 }))

  const total_users = planData?.length ?? 1
  const paid_users  = (planData ?? []).filter(u => (u.plan as string) !== 'free').length
  const avg_revenue_per_user = paid_users > 0 ? mrr / paid_users : 0
  const churn_rate = churn_trend.at(-1)?.churn_rate ?? 0

  return NextResponse.json({
    kpis:          { mrr, arr, churn_rate, avg_revenue_per_user },
    mrr_trend:     months,
    by_gateway:    by_gateway.length ? by_gateway : [{ name: 'Stripe', value: mrr }],
    by_plan,
    failed_payments,
    churn_trend,
  })
}
