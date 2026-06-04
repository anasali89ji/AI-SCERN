import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

async function sendSupportEmail(ticket: {
  subject: string; message: string; email: string
  priority: string; category: string; id: string
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const adminEmail = process.env.ADMIN_SUPPORT_EMAIL ?? 'support@aiscern.com'

  const priorityColor: Record<string, string> = {
    urgent: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#64748b',
  }
  const color = priorityColor[ticket.priority] ?? '#2563eb'

  await Promise.allSettled([
    // 1. Notify admin
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Aiscern Support <noreply@aiscern.com>',
        to:      [adminEmail],
        subject: `[Support] [${ticket.priority.toUpperCase()}] ${ticket.subject}`,
        reply_to: ticket.email,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <img src="https://aiscern.com/logo.png" alt="Aiscern" width="36"
              style="border-radius:8px;margin-bottom:16px"/>
            <h2 style="margin:0 0 4px;color:#111">New Support Ticket</h2>
            <p style="color:#888;margin:0 0 20px;font-size:13px">Ticket ID: ${ticket.id}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr>
                <td style="padding:8px 0;color:#555;width:100px">From</td>
                <td style="padding:8px 0;font-weight:600">${ticket.email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#555">Subject</td>
                <td style="padding:8px 0;font-weight:600">${ticket.subject}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#555">Priority</td>
                <td style="padding:8px 0">
                  <span style="background:${color}18;color:${color};padding:2px 10px;
                    border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase">
                    ${ticket.priority}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#555">Category</td>
                <td style="padding:8px 0">${ticket.category}</td>
              </tr>
            </table>
            <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0;white-space:pre-wrap;font-size:14px;color:#222">
                ${ticket.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </p>
            </div>
            <a href="https://admin.aiscern.com/dashboard"
              style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;
                border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-top:8px">
              View in Admin Panel →
            </a>
          </div>
        `,
      }),
    }),

    // 2. Auto-reply to user
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Aiscern Support <support@aiscern.com>',
        to:      [ticket.email],
        subject: `Re: ${ticket.subject} — We received your message`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <img src="https://aiscern.com/logo.png" alt="Aiscern" width="36"
              style="border-radius:8px;margin-bottom:16px"/>
            <h2 style="margin:0 0 8px;color:#111">We got your message</h2>
            <p style="color:#555;font-size:14px">
              Thanks for reaching out! We've received your support request and will get back
              to you as soon as possible.
            </p>
            <div style="background:#f5f5f5;border-radius:8px;padding:14px;margin:16px 0">
              <p style="margin:0;font-size:13px;color:#777"><strong>Ticket ID:</strong> ${ticket.id}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#777"><strong>Subject:</strong> ${ticket.subject}</p>
            </div>
            <p style="color:#555;font-size:13px">
              You can reply directly to this email if you have anything to add.
            </p>
            <p style="color:#888;font-size:12px;margin-top:24px">
              — Aiscern Support Team
            </p>
          </div>
        `,
      }),
    }),
  ])
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const db = getAdminDb()
  let query = db
    .from('support_tickets')
    .select('id, user_id, subject, message, status, priority, category, assigned_to, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tickets = (data ?? []).map(t => ({ ...t, email: t.user_id ?? 'unknown' }))
  return NextResponse.json(tickets)
}

export async function POST(req: NextRequest) {
  // Support ticket creation — called from the user-facing frontend
  // No admin auth required here so users can submit tickets
  try {
    const body = await req.json() as Record<string, unknown>
    const { subject, message, email, priority = 'medium', category = 'general', user_id } = body

    if (!subject || !message || !email) {
      return NextResponse.json({ error: 'subject, message and email are required' }, { status: 400 })
    }

    const db = getAdminDb()
    const { data, error } = await db
      .from('support_tickets')
      .insert({
        user_id:  user_id ?? email,
        subject:  String(subject).slice(0, 200),
        message:  String(message).slice(0, 5000),
        status:   'open',
        priority: String(priority),
        category: String(category),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fire-and-forget email notifications
    sendSupportEmail({
      id:       data.id as string,
      subject:  String(subject),
      message:  String(message),
      email:    String(email),
      priority: String(priority),
      category: String(category),
    }).catch(e => console.error('[support] email failed:', e))

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
