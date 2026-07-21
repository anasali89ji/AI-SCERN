import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'audit:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const action = searchParams.get('action') ?? ''
  const adminId = searchParams.get('adminId') ?? ''
  const limit = 50
  const offset = (page - 1) * limit

  const db = getAdminDb()
  let q = db
    .from('admin_audit_log')
    .select('id, action, admin_id, admin_ip, metadata, created_at, admin_users(email, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) q = q.eq('action', action)
  if (adminId) q = q.eq('admin_id', adminId)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    entries: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}
