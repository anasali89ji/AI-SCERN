import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  const db = getAdminDb()
  let query = db.from('content_flags').select('*, profiles(email, display_name)').order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const flags = (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    content_type: row.content_type,
    content_url: row.content_url,
    reason: row.reason,
    severity: row.severity,
    status: row.status,
    created_at: row.created_at,
    profiles: row.profiles,
  }))

  return NextResponse.json({
    flags,
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
  })
}
