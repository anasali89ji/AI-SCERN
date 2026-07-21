import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'errors:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const resolved = searchParams.get('resolved') === 'true'
  const severity = searchParams.get('severity')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50

  const db = getAdminDb()
  let query = db
    .from('error_logs')
    .select('id, message, path, count, resolved, first_seen, last_seen, created_at, stack_trace, severity')
    .eq('resolved', resolved)
    .order('last_seen', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (severity) query = query.eq('severity', severity)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    errors: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'errors:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db
    .from('error_logs')
    .update({
      resolved: body.resolved,
      resolved_by: auth.adminId,
      resolved_at: new Date().toISOString(),
      resolution_note: body.note || '',
    })
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('error_resolved', body.id, auth.ip, { resolved: body.resolved, note: body.note }, auth.adminId)
  return NextResponse.json(data)
}
