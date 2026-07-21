import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'webhooks:read')
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db
    .from('webhooks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'webhooks:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.url || !body.events || !Array.isArray(body.events)) {
    return NextResponse.json({ error: 'url and events array required' }, { status: 400 })
  }

  const db = getAdminDb()
  const secret = crypto.randomUUID()

  const { data, error } = await db.from('webhooks').insert({
    url: body.url,
    events: body.events,
    secret,
    active: body.active ?? true,
    description: body.description || '',
    created_by: auth.adminId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('webhook_created', data.id as string, auth.ip, { url: body.url }, auth.adminId)
  return NextResponse.json({ ...data, secret }, { status: 201 })
}
