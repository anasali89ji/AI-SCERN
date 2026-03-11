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

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).single()
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found. Please subscribe first.' }, { status: 400 })
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: 'https://detect-ai-nu.vercel.app/settings',
  })

  return NextResponse.json({ url: session.url })
}
