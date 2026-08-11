/**
 * /api/user/credits — live credits + plan data for profile page
 * Returns everything the profile Credits & Usage section needs.
 */
import { NextResponse }     from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Mirrors plan_limits (v10 + v16 daily_scans=200 for pro).
// 'pro' daily_scans is now an anti-abuse throttle, not the credit pool.
const PLAN_LIMITS: Record<string, { total_credits: number; daily_scans: number; label: string }> = {
  free:       { total_credits: 0,    daily_scans: 10,   label: 'Free' },
  starter:    { total_credits: 100,  daily_scans: 100,  label: 'Starter' },
  pro:        { total_credits: 500,  daily_scans: 200,  label: 'Pro' },
  enterprise: { total_credits: 9999, daily_scans: -1,   label: 'Enterprise' },
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })

    const db = getSupabaseAdmin()

    // 1. Profile — plan + credits + billing period
    const { data: profile } = await db
      .from('profiles')
      .select('plan, plan_id, credits_balance, credits_remaining, plan_updated_at, credit_period_start, credit_period_end, email, display_name')
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

    // Credits used = plan allocation - current balance (direct, always-correct
    // subtraction — NOT derived from a month-filtered transaction-ledger sum,
    // which was always 0 if the plan was granted in a prior calendar month).
    const creditsUsed = Math.max(0, planCfg.total_credits - balance)

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

      // Daily scans (secondary anti-abuse throttle for paid plans, primary
      // limit for free)
      scans_today:      scansToday ?? 0,
      daily_limit:      planCfg.daily_scans,      // -1 = unlimited
      daily_pct:        planCfg.daily_scans > 0
                          ? Math.min(100, Math.round(((scansToday ?? 0) / planCfg.daily_scans) * 100))
                          : 0,

      // Monthly / total
      scans_month:      scansMonth  ?? 0,
      scans_total:      scansTotal  ?? 0,

      plan_updated_at:      profile?.plan_updated_at ?? null,
      credit_period_start:  profile?.credit_period_start ?? null,
      credit_period_end:    profile?.credit_period_end ?? null,
    })
  } catch (err) {
    console.error('[user/credits]', err)
    return NextResponse.json({ success: false, error: { code: 'CREDITS_FETCH_FAILED', message: 'Failed to fetch credits' } }, { status: 500 })
  }
}
