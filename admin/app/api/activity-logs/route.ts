import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 50

    const db = getAdminDb()
    const { data, count, error } = await db
      .from('admin_activity_logs')
      .select('*, admin_users(email, name, role)')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      logs: data ?? [],
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
