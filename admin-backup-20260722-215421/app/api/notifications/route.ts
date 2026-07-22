import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'notifications:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50
  const offset = (page - 1) * limit
  const type = searchParams.get('type')
  const unreadOnly = searchParams.get('unread') === 'true'

  const db = getAdminDb()
  let query = db
    .from('notifications')
    .select('*, profiles(email, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)
  if (unreadOnly) query = query.eq('read', false)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    notifications: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'notifications:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db.from('notifications').insert({
    user_id: body.user_id || null,
    title: body.title,
    body: body.body,
    type: body.type || 'system',
    priority: body.priority || 'normal',
    action_url: body.action_url || null,
    metadata: body.metadata || {},
    target_audience: body.target_audience || 'all',
    expires_at: body.expires_at || null,
    read: false,
    dismissed: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('notification_created', data.id as string, auth.ip, body, auth.adminId)
  return NextResponse.json(data, { status: 201 })
}
