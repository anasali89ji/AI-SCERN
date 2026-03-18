import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db    = getSupabaseAdmin()
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const [users, scansToday, allScans] = await Promise.all([
      db.from('profiles').select('id,plan_id,is_banned', { count: 'exact' }),
      db.from('scans').select('id,media_type,verdict', { count: 'exact' }).gte('created_at', today.toISOString()),
      db.from('scans').select('verdict,media_type,confidence_score').gte('created_at',
        new Date(Date.now() - 7 * 86_400_000).toISOString()),
    ])

    const planCounts = (users.data ?? []).reduce((acc: Record<string,number>, u) => {
      acc[u.plan_id || 'free'] = (acc[u.plan_id || 'free'] || 0) + 1; return acc
    }, {})

    return NextResponse.json({
      ok: true,
      totalUsers: users.count ?? 0,
      scansToday: scansToday.count ?? 0,
      activeSubscriptions: Object.entries(planCounts).filter(([k]) => k !== 'free').reduce((a, [,v]) => a + v, 0),
      bannedUsers: (users.data ?? []).filter(u => u.is_banned).length,
      planDistribution: planCounts,
      weeklyScans: (allScans.data ?? []).length,
      aiRate: allScans.data?.length
        ? Math.round((allScans.data.filter(s => s.verdict === 'AI').length / allScans.data.length) * 100)
        : 0,
    })
  } catch (err: any) {
    console.error('[Analytics Overview]', err?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
