import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// Smart inbox routing — each subject type goes to the right team
const ROUTING: Record<string, { to: string; label: string }> = {
  security:   { to: 'security@aiscern.com', label: 'Security Team' },
  enterprise: { to: 'temah@aiscern.com',    label: 'Temah (Project Manager)' },
  support:    { to: 'support@aiscern.com',  label: 'Support Team' },
  general:    { to: 'contact@aiscern.com',  label: 'Aiscern Team' },
}

function getRouting(subject: string, routingHint?: string) {
  // Use explicit routing hint from frontend first
  if (routingHint && ROUTING[routingHint]) return ROUTING[routingHint]

  // Fallback: infer from subject text
  const s = subject.toLowerCase()
  if (s.includes('security') || s.includes('vulnerab'))   return ROUTING.security
  if (s.includes('enterprise') || s.includes('partner'))  return ROUTING.enterprise
  if (s.includes('support') || s.includes('bug') || s.includes('technical')) return ROUTING.support
  return ROUTING.general
}

const SUBJECT_COLOR: Record<string, string> = {
  security:   '#16a34a',
  enterprise: '#2563eb',
  support:    '#0891b2',
  general:    '#7c3aed',
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  try {
    const body = await req.json() as Record<string, string>
    const { name, email, subject, message, routing: routingHint } = body

    if (!name || !email || !message)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const safeName    = String(name).slice(0, 100)
    const safeEmail   = String(email).slice(0, 254)
    const safeSubject = String(subject || 'General Inquiry').slice(0, 200)
    const safeMessage = String(message).slice(0, 2000)

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(safeEmail))
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })

    const route    = getRouting(safeSubject, routingHint)
    const routeKey = routingHint && ROUTING[routingHint] ? routingHint : 'general'
    const accent   = SUBJECT_COLOR[routeKey] ?? '#2563eb'

    console.log('[Contact]', {
      name: safeName, email: safeEmail, subject: safeSubject,
      routed_to: route.to, ts: new Date().toISOString(),
    })

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const safeMsg = safeMessage
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')

      await Promise.allSettled([
        // 1. Notify the right inbox
        fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:     'Aiscern Contact <noreply@aiscern.com>',
            to:       [route.to],
            subject:  `[${safeSubject}] from ${safeName}`,
            reply_to: safeEmail,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
                  <img src="https://aiscern.com/logo.png" width="36" height="36"
                    style="border-radius:8px" alt="Aiscern"/>
                  <div>
                    <div style="font-weight:900;font-size:16px">Aiscern</div>
                    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Contact Form</div>
                  </div>
                </div>

                <div style="background:${accent}10;border-left:3px solid ${accent};
                  border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px">
                  <p style="margin:0;font-size:13px;color:${accent};font-weight:700">
                    ${safeSubject}
                  </p>
                  <p style="margin:4px 0 0;font-size:11px;color:#888">
                    Routed to: ${route.label}
                  </p>
                </div>

                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
                  <tr style="border-bottom:1px solid #eee">
                    <td style="padding:10px 0;color:#666;width:80px;vertical-align:top">Name</td>
                    <td style="padding:10px 0;font-weight:600">${safeName}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #eee">
                    <td style="padding:10px 0;color:#666;vertical-align:top">Email</td>
                    <td style="padding:10px 0">
                      <a href="mailto:${safeEmail}" style="color:${accent}">${safeEmail}</a>
                    </td>
                  </tr>
                </table>

                <div style="background:#f8f8f8;border-radius:10px;padding:16px;margin-bottom:24px">
                  <p style="margin:0;font-size:14px;line-height:1.7;color:#333">${safeMsg}</p>
                </div>

                <p style="font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:16px;margin:0">
                  Reply directly to this email to respond to ${safeName}.
                </p>
              </div>
            `,
          }),
        }),

        // 2. Auto-reply to sender
        fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'Aiscern <contact@aiscern.com>',
            to:      [safeEmail],
            subject: `We received your message — ${safeSubject}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
                  <img src="https://aiscern.com/logo.png" width="36" height="36"
                    style="border-radius:8px" alt="Aiscern"/>
                  <div style="font-weight:900;font-size:18px">Aiscern</div>
                </div>

                <h2 style="margin:0 0 8px;font-size:20px">Hi ${safeName},</h2>
                <p style="color:#555;font-size:14px;line-height:1.7">
                  Thanks for getting in touch! We've received your message and the right team has been notified.
                  We typically respond within <strong>24–48 hours</strong>.
                </p>

                <div style="background:#f5f5f5;border-radius:10px;padding:14px 16px;margin:20px 0">
                  <p style="margin:0;font-size:13px;color:#777">
                    <strong>Subject:</strong> ${safeSubject}
                  </p>
                </div>

                <p style="color:#555;font-size:13px;line-height:1.7">
                  In the meantime, you can also reach us directly:
                </p>

                <div style="margin:16px 0;space-y:8px">
                  ${[
                    { email: 'contact@aiscern.com',  label: 'General Inquiries' },
                    { email: 'support@aiscern.com',  label: 'Technical Support' },
                    { email: 'security@aiscern.com', label: 'Security Issues' },
                  ].map(e => `
                    <p style="margin:6px 0;font-size:13px">
                      <span style="color:#888">${e.label}: </span>
                      <a href="mailto:${e.email}" style="color:#2563eb;font-weight:600">${e.email}</a>
                    </p>
                  `).join('')}
                </div>

                <p style="color:#aaa;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px">
                  — Aiscern Team
                </p>
              </div>
            `,
          }),
        }),
      ])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact] error:', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
