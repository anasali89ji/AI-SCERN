import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data } = await getAdminDb()
    .from('admin_activity_logs')
    .select('*, admin_users(email, role)')
    .order('created_at', { ascending: false })
    .limit(200)
  return NextResponse.json({ ok: true, logs: data ?? [] })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
