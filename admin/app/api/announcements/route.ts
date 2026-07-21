import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction, checkAdminRateLimit } from '@/lib/admin-middleware'
import { notifyAnnouncementPublished } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'announcements:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const target = searchParams.get('target')

  const db = getAdminDb()
  let query = db
    .from('announcements')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (status === 'active') query = query.eq('active', true)
  if (status === 'inactive') query = query.eq('active', false)
  if (target && target !== 'all') query = query.eq('target_audience', target)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'announcements:write')
  if (auth instanceof NextResponse) return auth

  const rl = await checkAdminRateLimit(auth.ip, 'announcement_create', 60000, 10)
  if (rl.limited) {
    return NextResponse.json({ error: 'Rate limited', retryAfter: rl.resetAt }, { status: 429 })
  }

  const body = await req.json() as Record<string, unknown>
  if (!body.title || !body.content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const db = getAdminDb()
  const { data, error } = await db
    .from('announcements')
    .insert({
      title: body.title,
      content: body.content,
      type: body.type ?? 'info',
      target_audience: body.target_audience ?? 'all',
      priority: Number(body.priority) || 0,
      active: body.active ?? false,
      start_date: body.start_date ? new Date(body.start_date as string).toISOString() : new Date().toISOString(),
      end_date: body.end_date ? new Date(body.end_date as string).toISOString() : null,
      scheduled: body.scheduled ?? false,
      send_notification: body.send_notification ?? true,
      created_by: auth.adminId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger notifications if active and send_notification is true
  if (data && data.active && data.send_notification !== false) {
    notifyAnnouncementPublished(
      data.id as string,
      data.title as string,
      data.content as string,
      (data.target_audience as string) || 'all',
      (data.type as string) || 'info'
    ).catch(e => console.error('[announcements] Notification failed:', e))
  }

  await logAdminAction('announcement_created', data.id as string, auth.ip, {
    title: body.title,
    type: body.type,
    target: body.target_audience,
  }, auth.adminId)

  return NextResponse.json(data, { status: 201 })
}
