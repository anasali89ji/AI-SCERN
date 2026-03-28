import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const db = getSupabaseAdmin()
    const now = new Date()
    const todayStart = new Date(now.setHours(0,0,0,0)).toISOString()
    
    const [
      { count: totalUsers },
      { count: signupsToday },
      { count: totalScans },
      { count: scansToday },
      { count: bannedUsers },
      { count: revokedUsers },
      { data: recentSessions },
      { data: recentSignups },
      { data: scansByModality },
    ] = await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }),
      db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      db.from('scans').select('*', { count: 'exact', head: true }),
      db.from('scans').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('dashboard_access', false),
      db.from('user_sessions').select('user_id,email,event,created_at,ip,country,page').order('created_at', { ascending: false }).limit(50),
      db.from('profiles').select('email,created_at,plan').order('created_at', { ascending: false }).limit(20),
      db.from('scans').select('scan_type').limit(1000),
    ])

    // Active users in last 24h from sessions
    const { count: activeToday } = await db
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
    
    // Scans by modality
    const modalityCount: Record<string, number> = {}
    ;(scansByModality || []).forEach((s: any) => {
      modalityCount[s.scan_type] = (modalityCount[s.scan_type] || 0) + 1
    })

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      signupsToday: signupsToday || 0,
      totalScans: totalScans || 0,
      scansToday: scansToday || 0,
      bannedUsers: bannedUsers || 0,
      revokedUsers: revokedUsers || 0,
      activeToday: activeToday || 0,
      recentSessions: recentSessions || [],
      recentSignups: recentSignups || [],
      scansByModality: modalityCount,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
