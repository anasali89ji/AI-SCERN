import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'content_moderation:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  const db = getAdminDb()
  let query = db
    .from('content_flags')
    .select('*, profiles(email, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status !== 'all') query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    flags: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'content_moderation:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db.from('content_flags').insert({
    user_id: body.user_id,
    content_type: body.content_type,
    content_url: body.content_url,
    reason: body.reason,
    severity: body.severity || 'medium',
    status: 'pending',
    reported_by: auth.adminId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('content_flagged', data.id as string, auth.ip, body, auth.adminId)
  return NextResponse.json(data, { status: 201 })
}
