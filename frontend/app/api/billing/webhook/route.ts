import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const PLAN_CREDITS: Record<string, number> = {
  starter: 100,
  pro: 500,
  enterprise: -1,
  free: 5,
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check
  const { data: existing } = await supabase.from('stripe_events').select('id').eq('id', event.id).single()
  if (existing) return NextResponse.json({ ok: true, skipped: true })

  await supabase.from('stripe_events').insert({ id: event.id, type: event.type })

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.userId
      const planId  = session.metadata?.planId
      if (!userId || !planId) break

      await supabase.from('profiles').update({
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan_id:                planId,
        plan:                   planId,
        subscription_status:    'active',
        credits_remaining:      PLAN_CREDITS[planId] ?? 5,
        credits_reset_at:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', userId)

      await supabase.from('subscriptions').insert({
        user_id:               userId,
        plan_id:               planId,
        stripe_subscription_id: session.subscription as string,
        stripe_customer_id:    session.customer as string,
        status:                'active',
        current_period_start:  new Date().toISOString(),
        current_period_end:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId
      if (!userId) break

      const status = sub.status === 'active' ? 'active' : sub.status
      await supabase.from('profiles').update({
        subscription_status: status,
        subscription_period_end: new Date(((sub as any).current_period_end ?? 0) * 1000).toISOString(),
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('profiles').update({
        plan_id:             'free',
        plan:                'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        credits_remaining:   5,
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await supabase.from('profiles').update({
        subscription_status: 'past_due',
      }).eq('stripe_customer_id', invoice.customer as string)
      break
    }
  }

  return NextResponse.json({ ok: true })
}
