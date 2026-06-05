import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
import { planUpgradeEmail } from '@/lib/emails/templates'
import { sendEmail } from '@/lib/emails/send'

export const dynamic = 'force-dynamic'
type Params = Promise<{ id: string }>

const PLAN_CONFIG: Record<string, { credits: number; daily_scans: number; label: string }> = {
  free:       { credits: 0,    daily_scans: 10,   label: 'Free'       },
  starter:    { credits: 100,  daily_scans: 100,  label: 'Starter'    },
  pro:        { credits: 500,  daily_scans: 500,  label: 'Pro'        },
  enterprise: { credits: 9999, daily_scans: -1,   label: 'Enterprise' },
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const auth   = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body    = await req.json() as Record<string, string>
  const newPlan = (body.plan ?? body.planId ?? '').toLowerCase().trim()

  if (!PLAN_CONFIG[newPlan]) {
    return NextResponse.json(
      { error: `Invalid plan. Valid: ${Object.keys(PLAN_CONFIG).join(', ')}` },
      { status: 400 }
    )
  }

  const cfg = PLAN_CONFIG[newPlan]
  const db  = getAdminDb()

  // 1. Fetch current profile
  const { data: profile, error: fetchErr } = await db
    .from('profiles')
    .select('id, plan, credits_balance, email, display_name')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const oldPlan   = (profile.plan as string) ?? 'free'
  const userEmail = (profile.email as string) ?? ''
  const userName  = (profile.display_name as string) ?? ''

  // 2. Update profile — all plan columns atomically
  const { error: updateErr } = await db
    .from('profiles')
    .update({
      plan:                newPlan,
      plan_id:             newPlan,
      subscription_status: newPlan === 'free' ? 'free' : 'active',
      credits_balance:     cfg.credits,
      credits_remaining:   cfg.credits,
      plan_updated_at:     new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 3. Ledger entry
  if (cfg.credits > 0) {
    await db.from('credit_transactions').insert({
      user_id:          id,
      transaction_type: 'admin_grant',
      credits:          cfg.credits,
      plan_id:          newPlan,
      status:           'completed',
      metadata: {
        admin_ip: auth.ip,
        old_plan: oldPlan,
        new_plan: newPlan,
        reason:   'admin_plan_change',
      },
    })
  }

  // 4. Send branded upgrade email (non-blocking)
  if (userEmail) {
    const { subject, html } = planUpgradeEmail({
      name:       userName,
      email:      userEmail,
      newPlan,
      oldPlan,
      credits:    cfg.credits,
      dailyScans: cfg.daily_scans,
    })
    // Fire-and-forget — don't await so API response is instant
    sendEmail({ to: userEmail, subject, html }).catch(() => {})
  }

  // 5. Audit log
  await logAdminAction('plan_change', id, auth.ip, {
    old_plan: oldPlan, new_plan: newPlan, credits_set: cfg.credits,
  })

  return NextResponse.json({ ok: true, plan: newPlan, credits: cfg.credits })
}

export const PATCH = POST
