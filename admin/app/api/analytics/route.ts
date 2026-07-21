import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req, 'analytics:read')
    if (auth instanceof NextResponse) return auth

    const db = getAdminDb()
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '7d'
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const today = new Date(); today.setHours(0,0,0,0)

    const [scans, users, sessions, newToday, creditTx, notifications] = await Promise.all([
      db.from('scans').select('created_at,media_type,verdict,confidence_score,user_id').gte('created_at', since).order('created_at'),
      db.from('profiles').select('id,email,display_name,plan,plan_id,credits_remaining,scan_count,daily_scans,created_at,is_banned,plan_granted_by,country').order('created_at'),
      db.from('user_sessions').select('user_id,created_at').gte('created_at', new Date(Date.now() - 7*86400000).toISOString()),
      db.from('profiles').select('id').gte('created_at', today.toISOString()),
      db.from('credit_transactions').select('credits,transaction_type,created_at').gte('created_at', since),
      db.from('notifications').select('type,created_at').gte('created_at', since),
    ])

    const scanData = scans.data || []
    const userData = users.data || []
    const sessData = sessions.data || []
    const creditData = creditTx.data || []
    const notifData = notifications.data || []

    const activeUserIds = new Set(sessData.map((s: any) => s.user_id))

    const dailyMap: Record<string, any> = {}
    for (let i = days-1; i >= 0; i--) {
      const key = new Date(Date.now() - i*86400000).toISOString().slice(0,10)
      dailyMap[key] = { date: key, total:0, ai:0, human:0, uncertain:0, text:0, image:0, audio:0, video:0 }
    }
    for (const s of scanData) {
      const key = s.created_at?.slice(0,10)
      if (!key || !dailyMap[key]) continue
      dailyMap[key].total++
      if (s.verdict === 'AI') dailyMap[key].ai++
      if (s.verdict === 'HUMAN') dailyMap[key].human++
      if (s.verdict === 'UNCERTAIN') dailyMap[key].uncertain++
      if (s.media_type === 'text') dailyMap[key].text++
      if (s.media_type === 'image') dailyMap[key].image++
      if (s.media_type === 'audio') dailyMap[key].audio++
      if (s.media_type === 'video') dailyMap[key].video++
    }

    const planMap: Record<string,number> = {}
    for (const u of userData) { const p = u.plan || 'free'; planMap[p] = (planMap[p]||0)+1 }

    const verdictMap = { AI:0, HUMAN:0, UNCERTAIN:0 }
    for (const s of scanData) { if (s.verdict in verdictMap) (verdictMap as any)[s.verdict]++ }

    const toolMap: Record<string,number> = {}
    for (const s of scanData) { const t = s.media_type||'text'; toolMap[t] = (toolMap[t]||0)+1 }

    const ugMap: Record<string,number> = {}
    for (let i = days-1; i >= 0; i--) {
      ugMap[new Date(Date.now() - i*86400000).toISOString().slice(0,10)] = 0
    }
    for (const u of userData) {
      const k = u.created_at?.slice(0,10)
      if (k && ugMap[k] !== undefined) ugMap[k]++
    }

    // Credit usage
    const creditUsage = creditData.reduce((acc: number, tx: any) => acc + (Math.abs(tx.credits) || 0), 0)

    // Notification stats
    const notifTypes: Record<string, number> = {}
    for (const n of notifData) { notifTypes[n.type] = (notifTypes[n.type] || 0) + 1 }

    // Country distribution
    const countryMap: Record<string, number> = {}
    for (const u of userData) { if (u.country) countryMap[u.country] = (countryMap[u.country] || 0) + 1 }

    const totalScans = scanData.length
    const totalUsers = userData.length
    const activeUsers = userData.filter((u: any) => activeUserIds.has(u.id)).length
    const inactiveUsers = totalUsers - activeUsers
    const paidUsers = userData.filter((u: any) => u.plan && u.plan !== 'free').length
    const bannedUsers = userData.filter((u: any) => u.is_banned).length
    const adminGranted = userData.filter((u: any) => u.plan_granted_by).length
    const avgConf = scanData.length
      ? Math.round(scanData.reduce((a: number,s: any) => a + (s.confidence_score||0), 0) / scanData.length * 100)
      : 0

    return NextResponse.json({
      kpis: {
        totalScans, totalUsers, activeUsers, inactiveUsers,
        paidUsers, bannedUsers, adminGranted,
        avgConfidence: avgConf,
        newToday: newToday.data?.length || 0,
        creditUsage,
      },
      dailyScans: Object.values(dailyMap),
      dailyUsers: Object.entries(ugMap).map(([date, new_users]) => ({ date, new_users })),
      planDistribution: Object.entries(planMap).map(([plan, count]) => ({ plan, count })),
      verdictDistribution: Object.entries(verdictMap).map(([verdict, count]) => ({ verdict, count })),
      toolUsage: Object.entries(toolMap).map(([tool, count]) => ({ tool, count })),
      notificationTypes: Object.entries(notifTypes).map(([type, count]) => ({ type, count })),
      countryDistribution: Object.entries(countryMap).map(([country, count]) => ({ country, count })).sort((a,b) => b.count - a.count).slice(0, 10),
    })
  } catch (err: any) {
    console.error('[Admin analytics]', err?.message)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
