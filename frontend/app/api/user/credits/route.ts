/**
 * /api/user/credits — live credits + plan data for profile page
 * Returns everything the profile Credits & Usage section needs.
 */
import { NextResponse }     from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const PLAN_LIMITS: Record<string, { total_credits: number; daily_scans: number; label: string }> = {
  free:       { total_credits: 0,    daily_scans: 10,   label: 'Free' },
  starter:    { total_credits: 100,  daily_scans: 100,  label: 'Starter' },
  pro:        { total_credits: 500,  daily_scans: 500,  label: 'Pro' },
  enterprise: { total_credits: 9999, daily_scans: -1,   label: 'Enterprise' },
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseAdmin()

    // 1. Profile — plan + credits
    const { data: profile } = await db
      .from('profiles')
      .select('plan, plan_id, credits_balance, credits_remaining, plan_updated_at, email, display_name')
      .eq('id', userId)
      .maybeSingle()

    const plan      = profile?.plan ?? profile?.plan_id ?? 'free'
    const planCfg   = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
    const balance   = profile?.credits_balance ?? profile?.credits_remaining ?? 0

    // 2. Scans today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: scansToday } = await db
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())

    // 3. Scans this month
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const { count: scansMonth } = await db
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString())

    // 4. Total scans ever
    const { count: scansTotal } = await db
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    // 5. Credit transactions — credits used this period
    const { data: txns } = await db
      .from('credit_transactions')
      .select('credits, transaction_type, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', monthStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    // Credits granted this month vs consumed
    let creditsGranted = 0
    let creditsConsumed = 0
    for (const t of txns ?? []) {
      const amt = t.credits as number
      if (amt > 0) creditsGranted += amt
      else creditsConsumed += Math.abs(amt)
    }

    // Credits used = granted - remaining balance (floor at 0)
    const creditsUsed = Math.max(0, creditsGranted - balance)

    return NextResponse.json({
      plan,
      plan_label:       planCfg.label,
      is_paid:          plan !== 'free',

      // Credits
      credits_balance:  balance,
      credits_total:    planCfg.total_credits,
      credits_used:     creditsUsed,
      credits_pct:      planCfg.total_credits > 0
                          ? Math.min(100, Math.round((creditsUsed / planCfg.total_credits) * 100))
                          : 0,

      // Daily scans
      scans_today:      scansToday ?? 0,
      daily_limit:      planCfg.daily_scans,      // -1 = unlimited
      daily_pct:        planCfg.daily_scans > 0
                          ? Math.min(100, Math.round(((scansToday ?? 0) / planCfg.daily_scans) * 100))
                          : 0,

      // Monthly / total
      scans_month:      scansMonth  ?? 0,
      scans_total:      scansTotal  ?? 0,

      plan_updated_at:  profile?.plan_updated_at ?? null,
    })
  } catch (err) {
    console.error('[user/credits]', err)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
