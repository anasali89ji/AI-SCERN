import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'scans:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const mediaType = searchParams.get('type')
  const verdict = searchParams.get('verdict')
  const userId = searchParams.get('userId')
  const since = searchParams.get('since')

  const db = getAdminDb()
  let query = db
    .from('scans')
    .select('*, profiles(email, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (mediaType) query = query.eq('media_type', mediaType)
  if (verdict) query = query.eq('verdict', verdict)
  if (userId) query = query.eq('user_id', userId)
  if (since) query = query.gte('created_at', since)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    scans: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}
