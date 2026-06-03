import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db
    .from('announcements')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  if (!body.title || !body.content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const db = getAdminDb()
  const { data, error } = await db
    .from('announcements')
    .insert({
      title:           body.title,
      content:         body.content,
      type:            body.type ?? 'info',
      target_audience: body.target_audience ?? 'all',
      priority:        body.priority ?? 0,
      active:          body.active ?? false,
      start_date:      new Date().toISOString(),
      end_date:        body.end_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('announcement_created', data.id as string, auth.ip, { title: body.title })
  return NextResponse.json(data, { status: 201 })
}
