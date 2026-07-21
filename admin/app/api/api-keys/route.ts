import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'apikeys:read')
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db
    .from('api_keys')
    .select('id, user_id, name, key_prefix, permissions, rate_limit, last_used_at, expires_at, revoked_at, created_at, usage_count')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get user emails
  const userIds = [...new Set((data ?? []).map((k: any) => k.user_id).filter(Boolean))]
  const { data: profiles } = await db.from('profiles').select('id, email').in('id', userIds)
  const emailMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]))

  const keys = (data ?? []).map((k: any) => ({
    ...k,
    user_email: emailMap.get(k.user_id) || k.user_id,
  }))

  return NextResponse.json(keys)
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'apikeys:write')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db.from('api_keys').insert({
    user_id: body.user_id,
    name: body.name,
    key_prefix: body.key_prefix,
    permissions: body.permissions || ['read'],
    rate_limit: body.rate_limit || 100,
    expires_at: body.expires_at || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
