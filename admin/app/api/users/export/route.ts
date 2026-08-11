import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'all'
  const format = searchParams.get('format') || 'csv'

  const db = getAdminDb()
  let query = db.from('profiles').select(
    'id, email, display_name, plan, plan_id, credits_balance, scan_count, monthly_scans, is_banned, subscription_status, country, last_login_at, created_at'
  )

  if (filter === 'banned') query = query.eq('is_banned', true)
  if (filter === 'pro') query = query.eq('plan', 'pro')
  if (filter === 'free') query = query.eq('plan', 'free')
  if (filter === 'enterprise') query = query.eq('plan', 'enterprise')
  if (filter === 'starter') query = query.eq('plan', 'starter')
  if (filter === 'team') query = query.eq('plan', 'team')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (format === 'json') {
    return NextResponse.json(data || [])
  }

  const headers = ['ID', 'Email', 'Name', 'Plan', 'Credits', 'Scans', 'Banned', 'Status', 'Country', 'Last Login', 'Created']
  const rows = (data || []).map(u => [
    u.id, u.email, u.display_name || '', u.plan || 'free', u.credits_balance || 0,
    u.scan_count || u.monthly_scans || 0, u.is_banned ? 'Yes' : 'No', u.subscription_status || '',
    u.country || '', u.last_login_at || '', u.created_at || ''
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users_export_${new Date().toISOString().slice(0,10)}.csv"`
    }
  })
}
