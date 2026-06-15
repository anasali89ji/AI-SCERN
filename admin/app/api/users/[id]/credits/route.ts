import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
import { creditsUpdateEmail } from '@/lib/emails/templates'
import { sendEmail } from '@/lib/emails/send'

export const dynamic = 'force-dynamic'
type Params = Promise<{ id: string }>

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
    .select('id, credits_balance, credits_remaining, credit_period_start, credit_period_end, email, display_name')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const oldBalance = (profile.credits_balance as number) ?? 0
  const newBalance = Math.max(0, oldBalance + delta)
  const userEmail  = (profile.email as string) ?? ''
  const userName   = (profile.display_name as string) ?? ''

  // Update profile — if this user has no active billing period yet (e.g. a
  // manual credit grant on a free account), start one now so the profile
  // page can show an accurate "Resets on <date>". Top-ups within an existing
  // period don't push the renewal date out.
  const updatePayload: Record<string, unknown> = { credits_balance: newBalance, credits_remaining: newBalance }
  if (!profile.credit_period_end) {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    updatePayload.credit_period_start = now.toISOString()
    updatePayload.credit_period_end   = periodEnd.toISOString()
  }

  const { error: updateErr } = await db
    .from('profiles')
    .update(updatePayload)
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Ledger
  await db.from('credit_transactions').insert({
    user_id:          id,
    transaction_type: 'admin_grant',
    credits:          delta,
    status:           'completed',
    metadata: { admin_ip: auth.ip, reason, old_balance: oldBalance, new_balance: newBalance },
  })

  // Send branded email (fire-and-forget)
  if (userEmail) {
    const { subject, html } = creditsUpdateEmail({
      name:       userName,
      email:      userEmail,
      delta,
      newBalance,
      oldBalance,
      reason,
    })
    sendEmail({ to: userEmail, subject, html }).catch(() => {})
  }

  await logAdminAction('credit_grant', id, auth.ip, {
    delta, reason, old: oldBalance, new: newBalance,
  })

  return NextResponse.json({ ok: true, old_balance: oldBalance, new_balance: newBalance })
}

export const POST  = handleCredits
export const PATCH = handleCredits
