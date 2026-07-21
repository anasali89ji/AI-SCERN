import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

async function sendSupportEmail(ticket: any) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const adminEmail = process.env.ADMIN_SUPPORT_EMAIL ?? 'support@aiscern.com'
  const priorityColor: Record<string, string> = {
    urgent: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#64748b',
  }
  const color = priorityColor[ticket.priority] ?? '#2563eb'

  await Promise.allSettled([
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Aiscern Support <noreply@aiscern.com>',
        to: [adminEmail],
        subject: `[Support] [${ticket.priority.toUpperCase()}] ${ticket.subject}`,
        reply_to: ticket.email,
        html: generateAdminEmail(ticket, color),
      }),
    }),
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Aiscern Support <support@aiscern.com>',
        to: [ticket.email],
        subject: `Re: ${ticket.subject} — We received your message`,
        html: generateUserReply(ticket),
      }),
    }),
  ])
}

function generateAdminEmail(ticket: any, color: string) {
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 4px;color:#111">New Support Ticket</h2>
    <p style="color:#888;margin:0 0 20px;font-size:13px">Ticket ID: ${ticket.id}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#555;width:100px">From</td><td style="padding:8px 0;font-weight:600">${ticket.email}</td></tr>
      <tr><td style="padding:8px 0;color:#555">Subject</td><td style="padding:8px 0;font-weight:600">${ticket.subject}</td></tr>
      <tr><td style="padding:8px 0;color:#555">Priority</td><td style="padding:8px 0"><span style="background:${color}18;color:${color};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700">${ticket.priority}</span></td></tr>
      <tr><td style="padding:8px 0;color:#555">Category</td><td style="padding:8px 0">${ticket.category}</td></tr>
    </table>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;white-space:pre-wrap;font-size:14px;color:#222">${ticket.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
  </div>`
}

function generateUserReply(ticket: any) {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 8px;color:#111">We got your message</h2>
    <p style="color:#555;font-size:14px">Thanks for reaching out! We've received your support request and will get back to you as soon as possible.</p>
    <div style="background:#f5f5f5;border-radius:8px;padding:14px;margin:16px 0">
      <p style="margin:0;font-size:13px;color:#777"><strong>Ticket ID:</strong> ${ticket.id}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#777"><strong>Subject:</strong> ${ticket.subject}</p>
    </div>
    <p style="color:#999;font-size:12px">This is an automated response. Please do not reply to this email.</p>
  </div>`
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'support:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'all'
  const priority = searchParams.get('priority')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  const db = getAdminDb()
  let query = db
    .from('support_tickets')
    .select('*, profiles(email, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status !== 'all') query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    tickets: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'support:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db.from('support_tickets').insert({
    user_id: body.user_id || null,
    email: body.email,
    subject: body.subject,
    message: body.message,
    priority: body.priority || 'medium',
    category: body.category || 'general',
    status: 'open',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  sendSupportEmail(data).catch(() => {})

  await logAdminAction('support_ticket_created', data.id as string, auth.ip, body, auth.adminId)
  return NextResponse.json(data, { status: 201 })
}
