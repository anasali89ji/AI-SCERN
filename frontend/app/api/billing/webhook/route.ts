import { NextRequest, NextResponse } from 'next/server'
import { verifyXPayWebhook, XPAY_PLANS, type XPayPlanId } from '@/lib/xpay/client'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let payload: any

  try { payload = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Skip signature check in dev if secret is not set
  if (process.env.XPAY_SECRET_KEY) {
    if (!verifyXPayWebhook(payload, rawBody)) {
      console.error('[webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const { order_id, transaction_id, status, metadata } = payload
  if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .from('orders')
    .select('status')
    .eq('id', order_id)
    .maybeSingle()

  if (existing?.status === 'completed') {
    return NextResponse.json({ ok: true, message: 'Already processed' })
  }

  // Parse metadata
  const meta = metadata || {}
  const userId = meta.user_id
  const planId = meta.plan_id as XPayPlanId
  const plan   = planId ? XPAY_PLANS[planId] : null

  if (status === 'SUCCESS' && userId && plan) {
    const now        = new Date()
    const periodEnd  = new Date(now)
    if (plan.period === 'yearly')  periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    else                           periodEnd.setMonth(periodEnd.getMonth() + 1)

    // Grant credits + update subscription
    await Promise.all([
      // Update profile with new plan
      supabase.from('profiles').upsert({
        id:                userId,
        plan_id:           planId,
        credits_remaining: plan.credits === -1 ? 999999 : plan.credits,
        subscription_status: 'active',
        updated_at:        now.toISOString(),
      }, { onConflict: 'id' }),

      // Insert subscription record
      supabase.from('subscriptions').upsert({
        user_id:        userId,
        plan_id:        planId,
        status:         'active',
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
        payment_provider:     'xpay',
        provider_order_id:    order_id,
        provider_txn_id:      transaction_id,
        updated_at:      now.toISOString(),
      }, { onConflict: 'user_id' }),

      // Log credit grant
      supabase.from('credit_transactions').insert({
        user_id:     userId,
        type:        'purchase',
        amount:      plan.credits === -1 ? 999999 : plan.credits,
        description: `${plan.name} — XPay txn ${transaction_id}`,
        created_at:  now.toISOString(),
      }),

      // Update order status
      supabase.from('orders').upsert({
        id:            order_id,
        user_id:       userId,
        plan_id:       planId,
        status:        'completed',
        transaction_id,
        completed_at:  now.toISOString(),
      }, { onConflict: 'id' }),
    ])

    console.log(`[webhook] Order ${order_id} completed — user ${userId} upgraded to ${planId}`)
  } else if (status === 'FAILED') {
    await supabase.from('orders').upsert({
      id: order_id,
      status: 'failed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
