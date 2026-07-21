import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'json'
  const filter = searchParams.get('filter') || 'all'

  const db = getAdminDb()
  let query = db
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (filter === 'active') query = query.eq('is_banned', false)
  if (filter === 'banned') query = query.eq('is_banned', true)
  if (filter === 'pro') query = query.eq('plan', 'pro')
  if (filter === 'free') query = query.eq('plan', 'free')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data ?? []

  if (format === 'csv') {
    const headers = ['ID', 'Email', 'Display Name', 'Plan', 'Status', 'Credits', 'Scans', 'Created At', 'Banned']
    const rows = users.map((u: any) => [
      u.id, u.email, u.display_name, u.plan, u.subscription_status,
      u.credits_balance, u.scan_count, u.created_at, u.is_banned
    ].map(v => `"${String(v).replace(/"/g, '\"')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ users, count: users.length, exported_at: new Date().toISOString() })
}
