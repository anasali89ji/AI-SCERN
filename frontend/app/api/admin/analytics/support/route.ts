import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db   = getSupabaseAdmin()
    const days = 30
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    const [scans, users] = await Promise.all([
      db.from('scans').select('created_at,media_type,verdict,confidence_score').gte('created_at', since),
      db.from('profiles').select('created_at,plan_id,scan_count,is_banned'),
    ])

    const scanData = scans.data ?? []
    const userData = users.data ?? []

    // Build daily breakdown
    const daily: Record<string, Record<string, number>> = {}
    for (let i = days - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
      daily[key] = { total: 0, ai: 0, human: 0, uncertain: 0, text: 0, image: 0, audio: 0, video: 0 }
    }
    for (const s of scanData) {
      const key = s.created_at?.slice(0, 10)
      if (!key || !daily[key]) continue
      daily[key].total++
      if (s.verdict === 'AI')        daily[key].ai++
      if (s.verdict === 'HUMAN')     daily[key].human++
      if (s.verdict === 'UNCERTAIN') daily[key].uncertain++
      if (s.media_type)              daily[key][s.media_type] = (daily[key][s.media_type] || 0) + 1
    }

    const planMap: Record<string, number> = {}
    for (const u of userData) {
      const p = u.plan_id || 'free'
      planMap[p] = (planMap[p] || 0) + 1
    }

    return NextResponse.json({
      ok: true,
      kpis: {
        totalScans: scanData.length,
        totalUsers: userData.length,
        aiDetected: scanData.filter(s => s.verdict === 'AI').length,
        humanDetected: scanData.filter(s => s.verdict === 'HUMAN').length,
        avgConfidence: scanData.length
          ? Math.round(scanData.reduce((a, s) => a + (s.confidence_score ?? 0), 0) / scanData.length * 100)
          : 0,
        bannedUsers: userData.filter(u => u.is_banned).length,
        paidUsers: userData.filter(u => u.plan_id && u.plan_id !== 'free').length,
      },
      dailyBreakdown: Object.entries(daily).map(([date, v]) => ({ date, ...v })),
      planDistribution: Object.entries(planMap).map(([plan, count]) => ({ plan, count })),
      toolBreakdown: ['text','image','audio','video'].map(t => ({
        tool: t,
        count: scanData.filter(s => s.media_type === t).length,
      })),
    })
  } catch (err: any) {
    console.error('[Analytics API]', err?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
