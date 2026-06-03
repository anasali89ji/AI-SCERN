import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const db = getAdminDb()
  let query = db
    .from('support_tickets')
    .select('id, user_id, subject, message, status, priority, category, assigned_to, created_at, updated_at, users(email)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tickets = (data ?? []).map(t => ({
    ...t,
    email: (t.users as unknown as Record<string, string>)?.email ?? 'unknown',
  }))

  return NextResponse.json(tickets)
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  const db = getAdminDb()
  const { data, error } = await db
    .from('support_tickets')
    .insert({ ...body, status: body.status ?? 'open' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
