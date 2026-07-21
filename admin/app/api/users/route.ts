import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || searchParams.get('q') || ''
  const filter = searchParams.get('filter') || 'all'
  const sortBy = searchParams.get('sort') || 'created_at'
  const sortOrder = searchParams.get('order') || 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

  const db = getAdminDb()
  let query = db
    .from('profiles')
    .select(
      'id, email, display_name, plan, plan_id, credits_balance, credits_remaining, ' +
      'scan_count, monthly_scans, created_at, updated_at, is_banned, ' +
      'subscription_status, plan_updated_at, last_login_at, country, ' +
      'credit_period_start, credit_period_end, plan_granted_by',
      { count: 'exact' }
    )
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range((page - 1) * limit, page * limit - 1)

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  switch (filter) {
    case 'active': query = query.eq('is_banned', false); break
    case 'banned': query = query.eq('is_banned', true); break
    case 'pro': query = query.eq('plan', 'pro'); break
    case 'starter': query = query.eq('plan', 'starter'); break
    case 'free': query = query.eq('plan', 'free'); break
    case 'enterprise': query = query.eq('plan', 'enterprise'); break
    case 'team': query = query.eq('plan', 'team'); break
    case 'recent':
      const recent = new Date(Date.now() - 7 * 86400000).toISOString()
      query = query.gte('created_at', recent)
      break
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (data ?? []).map((raw: any) => ({
    id: raw.id,
    email: raw.email ?? '',
    display_name: raw.display_name ?? '',
    plan: raw.plan ?? raw.plan_id ?? 'free',
    status: raw.is_banned ? 'banned' : (raw.subscription_status ?? 'active'),
    scans_used: raw.scan_count ?? raw.monthly_scans ?? 0,
    credits_balance: raw.credits_balance ?? raw.credits_remaining ?? 0,
    credits_remaining: raw.credits_remaining ?? raw.credits_balance ?? 0,
    is_banned: raw.is_banned ?? false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    last_login_at: raw.last_login_at,
    country: raw.country,
    plan_updated_at: raw.plan_updated_at,
    credit_period_start: raw.credit_period_start,
    credit_period_end: raw.credit_period_end,
    plan_granted_by: raw.plan_granted_by,
  }))

  return NextResponse.json({
    users,
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
    page,
    limit,
  })
}
