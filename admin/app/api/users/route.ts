import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || searchParams.get('q') || ''
  const filter = searchParams.get('filter') || 'all'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit  = 20

  const db = getAdminDb()
  let query = db
    .from('profiles')
    .select(
      'id, email, plan, plan_id, credits_balance, credits_remaining, scan_count, ' +
      'monthly_scans, created_at, is_banned, subscription_status, plan_updated_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  // Search
  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  // Filter
  switch (filter) {
    case 'active':
      query = query.eq('is_banned', false); break
    case 'banned':
      query = query.eq('is_banned', true); break
    case 'pro':
      query = query.eq('plan', 'pro'); break
    case 'starter':
      query = query.eq('plan', 'starter'); break
    case 'free':
      query = query.eq('plan', 'free'); break
    case 'enterprise':
      query = query.eq('plan', 'enterprise'); break
    // 'all' — no filter
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalise rows so UsersTab always gets consistent shape
  const users = (data ?? []).map(raw => {
    const u = raw as unknown as Record<string, unknown>
    return {
      id:              u.id as string,
      email:           (u.email as string) ?? '',
      plan:            (u.plan as string) ?? (u.plan_id as string) ?? 'free',
      status:          u.is_banned ? 'banned' : ((u.subscription_status as string) ?? 'active'),
      scans_used:      (u.scan_count as number) ?? (u.monthly_scans as number) ?? 0,
      credits_balance: (u.credits_balance as number) ?? (u.credits_remaining as number) ?? 0,
      is_banned:       (u.is_banned as boolean) ?? false,
      created_at:      u.created_at as string,
      plan_updated_at: u.plan_updated_at as string | null,
    }
  })

  return NextResponse.json({
    users,
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / limit),
  })
}
