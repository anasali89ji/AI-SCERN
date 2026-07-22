export async function sendEmail(opts: {
  to: string; subject: string; html: string; from?: string; replyTo?: string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[email] RESEND_API_KEY not set'); return }
  if (!opts.to?.includes('@')) { console.warn('[email] invalid recipient:', opts.to); return }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: opts.from ?? 'Aiscern <noreply@aiscern.com>',
        to: [opts.to], subject: opts.subject, html: opts.html,
        reply_to: opts.replyTo ?? 'support@aiscern.com',
      }),
    })
    if (!res.ok) { console.error('[email] Resend error:', res.status, await res.text()) }
    else { const d = await res.json(); console.log('[email] sent →', opts.to, '| id:', (d as any).id) }
  } catch (e) { console.error('[email] fetch failed:', e) }
}
