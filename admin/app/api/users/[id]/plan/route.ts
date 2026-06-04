import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// Must match plan_limits table + Profile type in frontend
const PLAN_CONFIG: Record<string, { credits: number; daily_scans: number; label: string }> = {
  free:       { credits: 0,    daily_scans: 10,   label: 'Free' },
  starter:    { credits: 100,  daily_scans: 100,  label: 'Starter' },
  pro:        { credits: 500,  daily_scans: 500,  label: 'Pro' },
  enterprise: { credits: 9999, daily_scans: -1,   label: 'Enterprise' },
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, string>
  // Accept both 'plan' and 'planId' from different callers
  const newPlan = (body.plan ?? body.planId ?? '').toLowerCase()

  if (!PLAN_CONFIG[newPlan]) {
    return NextResponse.json(
      { error: `Invalid plan. Valid values: ${Object.keys(PLAN_CONFIG).join(', ')}` },
      { status: 400 }
    )
  }

  const cfg = PLAN_CONFIG[newPlan]
  const db  = getAdminDb()

  // 1. Fetch current profile
  const { data: profile, error: fetchErr } = await db
    .from('profiles')
    .select('id, plan, credits_balance, email')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const oldPlan = profile.plan as string

  // 2. Update profiles — all plan-related columns in one shot
  const { error: updateErr } = await db
    .from('profiles')
    .update({
      plan:                newPlan,
      plan_id:             newPlan,
      subscription_status: newPlan === 'free' ? 'free' : 'active',
      credits_balance:     cfg.credits,
      credits_remaining:   cfg.credits,   // alias used in some queries
      plan_updated_at:     new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 3. Insert credit_transactions ledger entry (so frontend scan guard picks it up)
  if (cfg.credits > 0) {
    await db.from('credit_transactions').insert({
      user_id:          id,
      transaction_type: 'admin_grant',
      credits:          cfg.credits,
      plan_id:          newPlan,
      status:           'completed',
      metadata:         {
        admin_ip:  auth.ip,
        old_plan:  oldPlan,
        new_plan:  newPlan,
        reason:    'admin_plan_change',
      },
    })
  }

  // 4. Send email notification to user via Resend (non-fatal)
  const resendKey = process.env.RESEND_API_KEY
  const userEmail = profile.email as string
  if (resendKey && userEmail) {
    try {
      await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Aiscern <noreply@aiscern.com>',
          to:      [userEmail],
          subject: `Your Aiscern plan has been updated to ${cfg.label}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <img src="https://aiscern.com/logo.png" alt="Aiscern" width="40" style="border-radius:8px;margin-bottom:16px"/>
              <h2 style="margin:0 0 8px">Plan Updated</h2>
              <p style="color:#555">Your Aiscern account plan has been updated by our team.</p>
              <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0"><strong>New plan:</strong> ${cfg.label}</p>
                <p style="margin:8px 0 0"><strong>Credits:</strong> ${cfg.credits === 9999 ? 'Unlimited' : cfg.credits}</p>
                <p style="margin:8px 0 0"><strong>Daily scans:</strong> ${cfg.daily_scans === -1 ? 'Unlimited' : cfg.daily_scans}</p>
              </div>
              <p style="color:#555">If you have questions, reply to this email or contact support@aiscern.com</p>
            </div>
          `,
        }),
      })
    } catch (e) {
      console.warn('[plan] Resend notification failed (non-fatal):', e)
    }
  }

  // 5. Audit log
  await logAdminAction('plan_change', id, auth.ip, {
    old_plan: oldPlan, new_plan: newPlan, credits_set: cfg.credits,
  })

  return NextResponse.json({ ok: true, plan: newPlan, credits: cfg.credits })
}

// Also support PATCH (UsersTab sends PATCH)
export const PATCH = POST
