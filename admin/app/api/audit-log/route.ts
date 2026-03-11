import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data } = await db.from('admin_audit_log')
    .select('*').order('created_at', { ascending: false }).limit(100)
  return NextResponse.json({ logs: data || [] })
}
