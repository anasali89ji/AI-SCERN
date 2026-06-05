import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'
type Params = Promise<{ id: string }>

async function sendCreditEmail(opts: {
  email: string; name?: string; delta: number
  newBalance: number; oldBalance: number; reason: string
}) {
  const key = process.env.RESEND_API_KEY
  if (!key || !opts.email) return
  const added   = opts.delta > 0
  const color   = added ? '#16a34a' : '#dc2626'
  const action  = added ? 'added to' : 'deducted from'
  const amount  = Math.abs(opts.delta)

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Aiscern <noreply@aiscern.com>',
      to:      [opts.email],
      subject: `${added ? '🎉' : '📊'} ${amount} credit${amount !== 1 ? 's' : ''} ${action} your account`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
            <img src="https://aiscern.com/logo.png" width="36" height="36"
              style="border-radius:8px" alt="Aiscern"/>
            <div style="font-weight:900;font-size:18px">Aiscern</div>
          </div>

          <h2 style="margin:0 0 8px;font-size:20px">
            Credits ${added ? 'Added' : 'Adjusted'}
          </h2>
          <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 20px">
            ${opts.name ? `Hi ${opts.name}, your` : 'Your'} Aiscern account credits have been updated.
          </p>

          <div style="background:#f8f8f8;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="color:#666;font-size:14px">Change</span>
              <span style="font-weight:700;font-size:18px;color:${color}">
                ${added ? '+' : ''}${opts.delta} credits
              </span>
            </div>
            <div style="height:1px;background:#e5e5e5;margin-bottom:12px"></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:#666;font-size:13px">Previous Balance</span>
              <span style="font-size:13px;font-weight:600">${opts.oldBalance}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:#666;font-size:13px">New Balance</span>
              <span style="font-size:15px;font-weight:700;color:#2563eb">${opts.newBalance}</span>
            </div>
          </div>

          ${opts.reason && opts.reason !== 'admin_grant' ? `
            <p style="color:#888;font-size:12px;margin-bottom:20px">
              Reason: ${opts.reason}
            </p>` : ''}

          <a href="https://aiscern.com/profile"
            style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;
              border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
            View My Profile →
          </a>

          <p style="color:#aaa;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">
            Questions? Reply to this email or contact
            <a href="mailto:support@aiscern.com" style="color:#2563eb">support@aiscern.com</a>
          </p>
        </div>
      `,
    }),
  }).catch(e => console.warn('[credits] email failed:', e))
}

async function handleCredits(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const auth   = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body   = await req.json() as Record<string, unknown>
  const delta  = Number(body.delta)
  const reason = String(body.reason ?? 'admin_grant')

  if (!delta || isNaN(delta))
    return NextResponse.json({ error: 'delta (number) is required' }, { status: 400 })

  const db = getAdminDb()

  // Fetch current profile
  const { data: profile, error: fetchErr } = await db
    .from('profiles')
    .select('id, credits_balance, credits_remaining, email, display_name')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const oldBalance = (profile.credits_balance as number) ?? 0
  const newBalance = Math.max(0, oldBalance + delta)

  // Update both credit columns
  const { error: updateErr } = await db
    .from('profiles')
    .update({ credits_balance: newBalance, credits_remaining: newBalance })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Ledger entry
  await db.from('credit_transactions').insert({
    user_id:          id,
    transaction_type: 'admin_grant',
    credits:          delta,
    status:           'completed',
    metadata: {
      admin_ip: auth.ip, reason,
      old_balance: oldBalance, new_balance: newBalance,
    },
  })

  // Send email to user (non-fatal)
  sendCreditEmail({
    email:      (profile.email as string) ?? '',
    name:       profile.display_name as string | undefined,
    delta,
    newBalance,
    oldBalance,
    reason,
  })

  await logAdminAction('credit_grant', id, auth.ip, {
    delta, reason, old: oldBalance, new: newBalance,
  })

  return NextResponse.json({ ok: true, old_balance: oldBalance, new_balance: newBalance })
}

export const POST  = handleCredits
export const PATCH = handleCredits
