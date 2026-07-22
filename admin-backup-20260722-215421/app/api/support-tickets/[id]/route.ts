import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'support:read')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const db = getAdminDb()
  const { data: ticket, error } = await db.from('support_tickets').select('*, profiles(email, display_name)').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: replies } = await db.from('support_replies').select('*').eq('ticket_id', id).order('created_at')

  return NextResponse.json({ ticket, replies: replies ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'support:write')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db
    .from('support_tickets')
    .update({
      status: body.status,
      priority: body.priority,
      assigned_to: body.assigned_to,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add reply if provided
  if (body.reply) {
    await db.from('support_replies').insert({
      ticket_id: id,
      admin_id: auth.adminId,
      message: body.reply,
      is_internal: body.is_internal || false,
    })
  }

  await logAdminAction('support_ticket_updated', id, auth.ip, body, auth.adminId)
  return NextResponse.json(data)
}
