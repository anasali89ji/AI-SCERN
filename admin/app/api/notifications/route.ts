import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, count, error } = await db
    .from('notifications')
    .select('*, profiles(email, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const notifications = (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    body: row.body,
    type: row.type,
    priority: row.priority,
    read: row.read,
    created_at: row.created_at,
    target_audience: row.target_audience,
    profiles: row.profiles,
  }))

  return NextResponse.json({
    notifications,
    total: count || 0,
    pages: Math.ceil((count || 0) / 20),
  })
}
