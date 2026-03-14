import { NextRequest, NextResponse } from 'next/server'
import { createXPayCheckout, XPAY_PLANS, type XPayPlanId } from '@/lib/xpay/client'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const { planId, userId, userEmail, userName } = body as {
      planId:    XPayPlanId
      userId:    string
      userEmail: string
      userName?: string
    }

    if (!planId || !userId || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const plan = XPAY_PLANS[planId]
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Generate unique order ID
    const orderId = `DAIORD-${userId.slice(0, 8)}-${Date.now()}`
    const baseUrl = req.nextUrl.origin

    const checkout = await createXPayCheckout({
      amount:        plan.pricePKR,
      orderId,
      description:   `DetectAI ${plan.name}`,
      customerName:  userName || 'DetectAI User',
      customerEmail: userEmail,
      successUrl:    `${baseUrl}/dashboard?payment=success&plan=${planId}`,
      failureUrl:    `${baseUrl}/pricing?payment=failed`,
      webhookUrl:    `${baseUrl}/api/billing/webhook`,
      metadata: {
        user_id:   userId,
        plan_id:   planId,
        plan_name: plan.name,
        credits:   plan.credits.toString(),
        period:    plan.period,
      },
    })

    if (!checkout.success) {
      return NextResponse.json({ error: checkout.error || 'Checkout creation failed' }, { status: 500 })
    }

    // Record pending order in Supabase
    getSupabaseAdmin().from('orders').upsert({
      id:           orderId,
      user_id:      userId,
      plan_id:      planId,
      amount_pkr:   plan.pricePKR,
      amount_usd:   plan.priceUSD,
      status:       'pending',
      payment_url:  checkout.paymentUrl,
      created_at:   new Date().toISOString(),
    }).then(() => {}, () => {}) // non-fatal if orders table doesn't exist yet

    return NextResponse.json({
      paymentUrl: checkout.paymentUrl,
      orderId:    checkout.orderId,
    })
  } catch (err: any) {
    console.error('[create-checkout]', err?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
