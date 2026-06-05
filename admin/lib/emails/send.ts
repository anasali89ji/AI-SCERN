/**
 * Thin Resend sender — used by all admin routes.
 * Fire-and-forget: never throws, always logs.
 */
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', opts.to)
    return
  }
  if (!opts.to || !opts.to.includes('@')) {
    console.warn('[email] invalid recipient:', opts.to)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:     opts.from     ?? 'Aiscern <noreply@aiscern.com>',
        to:       [opts.to],
        subject:  opts.subject,
        html:     opts.html,
        reply_to: opts.replyTo ?? 'support@aiscern.com',
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[email] Resend error:', res.status, body)
    } else {
      const d = await res.json() as { id?: string }
      console.log('[email] sent →', opts.to, '| id:', d.id)
    }
  } catch (e) {
    console.error('[email] fetch failed:', e)
  }
}
