import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const token = req.cookies.get('__session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    const parts = token.split('.')
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.sub || Date.now() / 1000 > payload.exp) throw new Error('expired')
    userId = payload.sub
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { planId, interval = 'monthly' } = await req.json()
  const priceEnvMap: Record<string, string | undefined> = {
    'starter-monthly':    process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    'starter-yearly':     process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    'pro-monthly':        process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    'pro-yearly':         process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    'enterprise-monthly': process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    'enterprise-yearly':  process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
  }
  const priceId = priceEnvMap[`${planId}-${interval}`]
  if (!priceId) return NextResponse.json({ error: 'Invalid plan or Stripe not configured' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('email, stripe_customer_id').eq('id', userId).single()
  const stripe = getStripe()
  const baseUrl = 'https://detect-ai-nu.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: profile?.stripe_customer_id || undefined,
    customer_email: !profile?.stripe_customer_id ? profile?.email || undefined : undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?upgraded=1`,
    cancel_url:  `${baseUrl}/pricing?canceled=1`,
    metadata: { userId, planId, interval },
    subscription_data: { metadata: { userId, planId } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
