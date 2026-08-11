import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '7d'
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const db = getAdminDb()

  const { data: users } = await db.from('profiles').select('*')
  const { data: scans } = await db.from('scans').select('*').gte('created_at', since)

  const dailyMap: Record<string, any> = {}
  for (const s of scans || []) {
    const day = s.created_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { date: day, ai: 0, human: 0, uncertain: 0, total: 0 }
    dailyMap[day][s.verdict?.toLowerCase() || 'uncertain'] += 1
    dailyMap[day].total += 1
  }

  const planDist = Object.entries(
    (users || []).reduce((acc: Record<string, number>, u) => {
      acc[u.plan || 'free'] = (acc[u.plan || 'free'] || 0) + 1
      return acc
    }, {})
  ).map(([plan, count]) => ({ plan, count }))

  const verdictDist = Object.entries(
    (scans || []).reduce((acc: Record<string, number>, s) => {
      acc[s.verdict || 'UNCERTAIN'] = (acc[s.verdict || 'UNCERTAIN'] || 0) + 1
      return acc
    }, {})
  ).map(([verdict, count]) => ({ verdict, count }))

  const toolUsage = [
    { tool: 'Text', count: (scans || []).filter(s => s.media_type === 'text').length },
    { tool: 'Image', count: (scans || []).filter(s => s.media_type === 'image').length },
    { tool: 'Audio', count: (scans || []).filter(s => s.media_type === 'audio').length },
    { tool: 'Video', count: (scans || []).filter(s => s.media_type === 'video').length },
  ]

  const dailyUsersMap: Record<string, any> = {}
  for (const u of users || []) {
    const day = u.created_at?.slice(0, 10)
    if (day) {
      if (!dailyUsersMap[day]) dailyUsersMap[day] = { date: day, new_users: 0 }
      dailyUsersMap[day].new_users += 1
    }
  }

  return NextResponse.json({
    kpis: {
      totalScans: (scans || []).length,
      totalUsers: (users || []).length,
      activeUsers: (users || []).filter((u: any) => u.last_login_at && new Date(u.last_login_at) > new Date(Date.now() - 7 * 86400000)).length,
      inactiveUsers: (users || []).filter((u: any) => !u.last_login_at || new Date(u.last_login_at) < new Date(Date.now() - 30 * 86400000)).length,
      paidUsers: (users || []).filter((u: any) => u.plan && u.plan !== 'free').length,
      bannedUsers: (users || []).filter((u: any) => u.is_banned).length,
      adminGranted: (users || []).filter((u: any) => u.plan_granted_by).length,
      newToday: (users || []).filter((u: any) => u.created_at && new Date(u.created_at) >= new Date(new Date().setHours(0,0,0,0))).length,
    },
    dailyScans: Object.values(dailyMap),
    planDistribution: planDist,
    verdictDistribution: verdictDist,
    toolUsage,
    dailyUsers: Object.values(dailyUsersMap).slice(-days),
  })
}
