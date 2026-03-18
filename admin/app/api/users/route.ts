import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const url = new URL(req.url)
  const q    = url.searchParams.get('q') || ''
  const plan = url.searchParams.get('plan') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 20

  let query = db.from('profiles')
    .select('id, email, display_name, plan_id, plan, credits_remaining, scan_count, created_at, is_banned, subscription_status', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
  if (plan) query = query.eq('plan_id', plan)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data, total: count, page, pages: Math.ceil((count || 0) / limit) })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
