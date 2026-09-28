import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const plan = searchParams.get('plan') || 'all'
  const status = searchParams.get('status') || 'all'
  const sortBy = searchParams.get('sortBy') || 'created_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

  const db = getAdminDb()
  let query = db.from('profiles').select('*')

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  }
  if (plan !== 'all') query = query.eq('plan', plan)
  if (status === 'banned') query = query.eq('is_banned', true)
  if (status === 'active') query = query.eq('is_banned', false)

  const { data, count, error } = await query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    users: data || [],
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
  })
}
