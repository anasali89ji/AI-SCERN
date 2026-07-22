import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const resolved = searchParams.get('resolved') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  const db = getAdminDb()
  const { data, count, error } = await db
    .from('error_logs')
    .select('*', { count: 'exact' })
    .eq('resolved', resolved)
    .order('last_seen', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    errors: data || [],
    pages: Math.ceil((count || 0) / limit),
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id, resolved, note } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getAdminDb()
  const { error } = await db.from('error_logs').update({
    resolved: !!resolved,
    resolution_note: note || null,
    last_seen: new Date().toISOString(),
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'error_resolved',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { error_id: id, resolved, note },
  })

  return NextResponse.json({ ok: true })
}
