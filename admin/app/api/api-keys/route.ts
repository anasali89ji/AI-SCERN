import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db
    .from('api_keys')
    .select('id, user_id, name, key_prefix, permissions, rate_limit, last_used_at, expires_at, revoked_at, created_at, users(email)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const keys = (data ?? []).map(k => ({
    ...k,
    user_email: (k.users as unknown as Record<string, string>)?.email ?? null,
  }))

  return NextResponse.json(keys)
}
