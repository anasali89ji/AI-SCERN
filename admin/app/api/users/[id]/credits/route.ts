import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

async function handleCredits(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  const delta  = Number(body.delta)
  const reason = String(body.reason ?? 'admin_grant')

  if (!delta || isNaN(delta)) {
    return NextResponse.json({ error: 'delta (number) is required' }, { status: 400 })
  }

  const db = getAdminDb()

  // 1. Fetch current balance
  const { data: profile, error: fetchErr } = await db
    .from('profiles')
    .select('id, credits_balance, email, plan')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const currentBalance = (profile.credits_balance as number) ?? 0
  const newBalance     = Math.max(0, currentBalance + delta) // never go below 0

  // 2. Update profile — both column names to cover schema variants
  const { error: updateErr } = await db
    .from('profiles')
    .update({
      credits_balance:   newBalance,
      credits_remaining: newBalance,
    })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 3. Insert immutable ledger entry
  const { error: ledgerErr } = await db
    .from('credit_transactions')
    .insert({
      user_id:          id,
      transaction_type: 'admin_grant',
      credits:          delta,
      status:           'completed',
      metadata: {
        admin_ip:        auth.ip,
        reason,
        old_balance:     currentBalance,
        new_balance:     newBalance,
      },
    })

  if (ledgerErr) {
    // Ledger fail is non-fatal — balance already updated
    console.error('[credits] ledger insert failed:', ledgerErr.message)
  }

  // 4. Audit log
  await logAdminAction('credit_grant', id, auth.ip, {
    delta, reason, old: currentBalance, new: newBalance,
  })

  return NextResponse.json({ ok: true, old_balance: currentBalance, new_balance: newBalance })
}

export const POST  = handleCredits
export const PATCH = handleCredits
