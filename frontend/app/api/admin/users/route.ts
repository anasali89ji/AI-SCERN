import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verifyAdmin, isAdminError } from '@/lib/auth/verify-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  try {
    const db  = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const page   = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all'
    const limit  = 25
    const offset = (page - 1) * limit

    let query = db.from('profiles')
      .select(
        'id,email,display_name,plan,plan_id,created_at,is_banned,dashboard_access,' +
        'access_revoked_at,scan_count,credits_remaining,daily_scans,daily_reset_at,' +
        'plan_granted_by,plan_granted_at,plan_expires_at',
        { count: 'exact' }
      )

    if (search) query = query.ilike('email', `%${search}%`)
    if (filter === 'banned')  query = query.eq('is_banned', true)
    if (filter === 'revoked') query = query.eq('dashboard_access', false)
    if (filter === 'pro')     query = query.in('plan', ['pro','team','enterprise'])
    if (filter === 'free')    query = query.eq('plan', 'free')
    if (filter === 'active')  query = query.eq('is_banned', false).neq('dashboard_access', false)

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return NextResponse.json({ users: data, total: count, page, limit })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  try {
    const { userId: targetId, action, reason, plan, expiresInDays } = await req.json()
    if (!targetId || !action)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db     = getSupabaseAdmin()
    const validActions = ['ban','unban','revoke','restore','grant_pro','revoke_pro','set_plan','reset_daily']
    if (!validActions.includes(action))
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    let update: Record<string, any> = {}

    if (action === 'ban')     update = { is_banned: true }
    if (action === 'unban')   update = { is_banned: false }
    if (action === 'revoke')  update = { dashboard_access: false, access_revoked_at: new Date().toISOString(), access_revoked_reason: reason || 'Admin action' }
    if (action === 'restore') update = { dashboard_access: true, access_revoked_at: null, access_revoked_reason: null }
    if (action === 'reset_daily') update = { daily_scans: 0, daily_reset_at: new Date().toISOString() }

    // Grant Pro — set plan to pro, record admin who granted, optional expiry
    if (action === 'grant_pro') {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
        : null
      update = {
        plan:             'pro',
        plan_id:          'pro',
        credits_remaining: 99999,
        plan_granted_by:  admin.userId,
        plan_granted_at:  new Date().toISOString(),
        plan_expires_at:  expiresAt,
      }
    }

    // Revoke Pro — revert to free
    if (action === 'revoke_pro') {
      update = {
        plan:             'free',
        plan_id:          'free',
        credits_remaining: 9999,
        plan_granted_by:  null,
        plan_granted_at:  null,
        plan_expires_at:  null,
      }
    }

    // Set arbitrary plan — for team/enterprise
    if (action === 'set_plan') {
      const validPlans = ['free','pro','team','enterprise']
      if (!plan || !validPlans.includes(plan))
        return NextResponse.json({ error: 'Invalid plan. Use: free, pro, team, enterprise' }, { status: 400 })
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
        : null
      update = {
        plan:             plan,
        plan_id:          plan,
        credits_remaining: plan === 'enterprise' ? 999999 : plan === 'team' ? 99999 : plan === 'pro' ? 99999 : 9999,
        plan_granted_by:  admin.userId,
        plan_granted_at:  new Date().toISOString(),
        plan_expires_at:  expiresAt,
      }
    }

    const { error } = await db.from('profiles').update(update).eq('id', targetId)
    if (error) throw error

    // Audit log
    try {
      await db.from('admin_activity_logs').insert({
        admin_id:   admin.userId,
        action:     `user_${action}`,
        target_id:  targetId,
        details:    { reason, plan: plan || update.plan, expires_at: update.plan_expires_at },
        created_at: new Date().toISOString(),
      })
    } catch { /* non-fatal */ }


    // Send upgrade notification to user
    if (action === 'grant_pro' || action === 'set_plan') {
      const grantedPlan = action === 'grant_pro' ? 'pro' : plan
      const planLabels: Record<string,string> = { pro:'Pro', team:'Team', enterprise:'Enterprise' }
      const label = planLabels[grantedPlan] || grantedPlan
      try {
        await db.from('user_notifications').insert({
          user_id: targetId,
          type: 'plan_upgrade',
          title: `🎉 You've been upgraded to ${label}!`,
          message: action === 'grant_pro'
            ? `Your account has been upgraded to Aiscern ${label} by an admin. You now have access to all detection modalities and ${grantedPlan === 'pro' ? '100' : grantedPlan === 'team' ? '500' : 'unlimited'} scans per day.`
            : `Your plan has been changed to ${label} by an admin.`,
          data: { plan: grantedPlan, expires_at: update.plan_expires_at || null },
          read: false,
        })
      } catch { /* non-fatal */ }
    }
    return NextResponse.json({ success: true, action, update })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
