import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

/**
 * Newsletter subscription endpoint.
 *
 * The footer form has always POSTed here, but the route never existed — every
 * submission 404'd silently (the `res.ok` check swallowed it). This restores
 * the conversion path with the same pattern as /api/contact: validate,
 * rate-limit, notify the team via Resend when configured, and degrade
 * gracefully when it is not.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  try {
    const body = await req.json().catch(() => null) as { email?: string } | null
    const email = String(body?.email ?? '').trim().slice(0, 254)

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      // Notify the team — fire-and-forget, never blocks the UX
      void fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Aiscern Newsletter <noreply@aiscern.com>',
          to:      ['contact@aiscern.com'],
          subject: `[Newsletter] new subscriber: ${email}`,
          reply_to: email,
          text:    `New newsletter subscriber:\n\n${email}\n\nSource: site footer form\nTime: ${new Date().toISOString()}`,
        }),
      }).catch(err => console.error('[subscribe] notify failed:', err))
    } else {
      console.log('[subscribe] new subscriber (no RESEND_API_KEY configured):', email)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[subscribe] error:', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
