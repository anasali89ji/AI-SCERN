import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()

  const [users, scans, tickets, errors] = await Promise.all([
    db.from('profiles').select('id').gte('created_at', new Date(Date.now() - 300000).toISOString()),
    db.from('scans').select('id').gte('created_at', new Date(Date.now() - 300000).toISOString()),
    db.from('support_tickets').select('id').eq('status', 'open'),
    db.from('error_logs').select('id').eq('resolved', false),
  ])

  return NextResponse.json({
    activeUsers: (users.data || []).length,
    activeScans: (scans.data || []).length,
    openTickets: (tickets.data || []).length,
    unresolvedErrors: (errors.data || []).length,
  })
}
