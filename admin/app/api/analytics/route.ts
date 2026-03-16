import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db     = getAdminDb()
  const url    = new URL(req.url)
  const period = url.searchParams.get('period') || '7d'

  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const [scans, users, flags, errors] = await Promise.all([
    db.from('scans')
      .select('created_at, media_type, verdict, confidence_score')
      .gte('created_at', since)
      .order('created_at'),
    db.from('profiles')
      .select('created_at, plan_id, scan_count')
      .order('created_at'),
    db.from('feature_flags').select('key, enabled, rollout_percentage').limit(50),
    db.from('error_logs')
      .select('service, created_at, resolved')
      .gte('created_at', since),
  ])

  const scanData  = scans.data  || []
  const userData  = users.data  || []
  const errorData = errors.data || []

  // ── Daily scan volumes ─────────────────────────────────────────────────────
  const dailyMap: Record<string, { total: number; ai: number; human: number; uncertain: number; text: number; image: number; audio: number; video: number }> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = { total: 0, ai: 0, human: 0, uncertain: 0, text: 0, image: 0, audio: 0, video: 0 }
  }
  for (const s of scanData) {
    const key = s.created_at?.slice(0, 10)
    if (!key || !dailyMap[key]) continue
    dailyMap[key].total++
    if (s.verdict === 'AI')        dailyMap[key].ai++
    if (s.verdict === 'HUMAN')     dailyMap[key].human++
    if (s.verdict === 'UNCERTAIN') dailyMap[key].uncertain++
    if (s.media_type === 'text')   dailyMap[key].text++
    if (s.media_type === 'image')  dailyMap[key].image++
    if (s.media_type === 'audio')  dailyMap[key].audio++
    if (s.media_type === 'video')  dailyMap[key].video++
  }
  const dailyScans = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

  // ── User growth ────────────────────────────────────────────────────────────
  const userGrowthMap: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    userGrowthMap[key] = 0
  }
  for (const u of userData) {
    const key = u.created_at?.slice(0, 10)
    if (key && userGrowthMap[key] !== undefined) userGrowthMap[key]++
  }
  const dailyUsers = Object.entries(userGrowthMap).map(([date, new_users]) => ({ date, new_users }))

  // ── Plan distribution ─────────────────────────────────────────────────────
  const planMap: Record<string, number> = {}
  for (const u of userData) {
    const p = u.plan_id || 'free'
    planMap[p] = (planMap[p] || 0) + 1
  }
  const planDistribution = Object.entries(planMap).map(([plan, count]) => ({ plan, count }))

  // ── Verdict distribution ───────────────────────────────────────────────────
  const verdictMap = { AI: 0, HUMAN: 0, UNCERTAIN: 0 }
  for (const s of scanData) {
    if (s.verdict in verdictMap) verdictMap[s.verdict as keyof typeof verdictMap]++
  }

  // ── Tool usage breakdown ───────────────────────────────────────────────────
  const toolMap: Record<string, number> = {}
  for (const s of scanData) {
    const t = s.media_type || 'unknown'
    toolMap[t] = (toolMap[t] || 0) + 1
  }
  const toolUsage = Object.entries(toolMap).map(([tool, count]) => ({ tool, count }))

  // ── Average confidence over time ──────────────────────────────────────────
  const confMap: Record<string, number[]> = {}
  for (const s of scanData) {
    const key = s.created_at?.slice(0, 10)
    if (key && s.confidence_score != null) {
      if (!confMap[key]) confMap[key] = []
      confMap[key].push(s.confidence_score * 100)
    }
  }
  const avgConfidence = Object.entries(confMap).map(([date, scores]) => ({
    date,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }))

  // ── Error rate by service ─────────────────────────────────────────────────
  const errMap: Record<string, { total: number; resolved: number }> = {}
  for (const e of errorData) {
    const s = e.service || 'unknown'
    if (!errMap[s]) errMap[s] = { total: 0, resolved: 0 }
    errMap[s].total++
    if (e.resolved) errMap[s].resolved++
  }
  const errorRates = Object.entries(errMap).map(([service, v]) => ({ service, ...v }))

  // ── Summary KPIs ──────────────────────────────────────────────────────────
  const totalScans   = scanData.length
  const totalUsers   = userData.length
  const paidUsers    = userData.filter(u => u.plan_id && u.plan_id !== 'free').length
  const convRate     = totalUsers > 0 ? +((paidUsers / totalUsers) * 100).toFixed(1) : 0
  const avgScansUser = totalUsers > 0 ? +(userData.reduce((s, u) => s + (u.scan_count || 0), 0) / totalUsers).toFixed(1) : 0

  return NextResponse.json({
    ok: true,
    period,
    kpis: { totalScans, totalUsers, paidUsers, convRate, avgScansUser },
    dailyScans,
    dailyUsers,
    planDistribution,
    verdictDistribution: Object.entries(verdictMap).map(([verdict, count]) => ({ verdict, count })),
    toolUsage,
    avgConfidence,
    errorRates,
    featureFlags: flags.data || [],
  })
}
