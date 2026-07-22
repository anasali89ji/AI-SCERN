import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
import { notifyAnnouncementPublished } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'announcements:read')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const db = getAdminDb()
  const { data, error } = await db.from('announcements').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'announcements:write')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json() as Record<string, unknown>
  const db = getAdminDb()

  // Get current state
  const { data: current } = await db.from('announcements').select('*').eq('id', id).single()

  const { data, error } = await db
    .from('announcements')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
      updated_by: auth.adminId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger notifications if activating for the first time or re-activating
  const wasActive = current?.active === true
  const isNowActive = body.active === true
  if (!wasActive && isNowActive && data && data.send_notification !== false) {
    notifyAnnouncementPublished(
      id,
      data.title as string,
      data.content as string,
      (data.target_audience as string) || 'all',
      (data.type as string) || 'info'
    ).catch(e => console.error('[announcements] Notification failed:', e))
  }

  await logAdminAction('announcement_updated', id, auth.ip, body, auth.adminId)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'announcements:delete')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const db = getAdminDb()
  const { error } = await db.from('announcements').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('announcement_deleted', id, auth.ip, {}, auth.adminId)
  return NextResponse.json({ ok: true })
}
