import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db
    .from('api_keys')
    .select('id, user_id, name, key_prefix, permissions, rate_limit, last_used_at, expires_at, revoked_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // No users table — expose user_id directly as user_email field
  const keys = (data ?? []).map(k => ({ ...k, user_email: k.user_id }))
  return NextResponse.json(keys)
}
