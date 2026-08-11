import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth

    const db = getAdminDb()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)

    const [
      users, scansToday, scansYesterday, subscriptions, creditTx,
      supportTickets, errors, newUsersWeek
    ] = await Promise.allSettled([
      db.from('profiles').select('id, plan_id, created_at, is_banned, last_login_at', { count: 'exact' }),
      db.from('scans').select('id, media_type, verdict').gte('created_at', today.toISOString()),
      db.from('scans').select('id').gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
      db.from('profiles').select('plan_id').neq('subscription_status', 'free').neq('plan_id', 'free'),
      db.from('credit_transactions').select('delta, credits').eq('reason', 'monthly_reset').gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString()),
      db.from('support_tickets').select('id, status').gte('created_at', weekAgo.toISOString()),
      db.from('error_logs').select('id, resolved').gte('created_at', weekAgo.toISOString()),
      db.from('profiles').select('id').gte('created_at', weekAgo.toISOString()),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { data: [], count: 0, error: null }))

    const planCounts = (subscriptions.data || []).reduce((acc: Record<string,number>, p: any) => {
      acc[p.plan_id] = (acc[p.plan_id] || 0) + 1; return acc
    }, {})

    const typeDist = (scansToday.data || []).reduce((acc: Record<string,number>, s: any) => {
      acc[s.media_type] = (acc[s.media_type] || 0) + 1; return acc
    }, {})

    const verdictDist = (scansToday.data || []).reduce((acc: Record<string,number>, s: any) => {
      acc[s.verdict] = (acc[s.verdict] || 0) + 1; return acc
    }, {})

    const activeToday = (users.data || []).filter((u: any) => u.last_login_at && new Date(u.last_login_at) >= today).length
    const activeWeek = (users.data || []).filter((u: any) => u.last_login_at && new Date(u.last_login_at) >= weekAgo).length

    return NextResponse.json({
      totalUsers: users.count || 0,
      scansToday: scansToday.data?.length || 0,
      scansYesterday: scansYesterday.data?.length || 0,
      activeSubscriptions: Object.values(planCounts).reduce((a: number, b: unknown) => a + (b as number), 0),
      planDistribution: planCounts,
      scanTypeDistribution: typeDist,
      verdictDistribution: verdictDist,
      bannedUsers: (users.data || []).filter((u: any) => u.is_banned).length,
      activeToday,
      activeWeek,
      newUsersWeek: newUsersWeek.data?.length || 0,
      openTickets: (supportTickets.data || []).filter((t: any) => t.status === 'open').length,
      unresolvedErrors: (errors.data || []).filter((e: any) => !e.resolved).length,
    })
  } catch (err: any) {
    console.error("[Admin stats]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
