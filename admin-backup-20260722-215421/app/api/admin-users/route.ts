import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction, hasPermission } from '@/lib/admin-middleware'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  if (!hasPermission(auth.role, 'admin_users:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getAdminDb()
  const { data, error } = await db
    .from('admin_users')
    .select('id, email, name, role, is_active, last_login_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super_admin can create admin users' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.email || !body.password || !body.role) {
    return NextResponse.json({ error: 'email, password, and role required' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(body.password, 12)
  const db = getAdminDb()

  const { data, error } = await db.from('admin_users').insert({
    email: body.email,
    name: body.name || body.email.split('@')[0],
    password_hash: passwordHash,
    role: body.role,
    is_active: true,
    created_by: auth.adminId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('admin_user_created', data.id as string, auth.ip, {
    email: body.email,
    role: body.role,
  }, auth.adminId)

  return NextResponse.json({
    ok: true,
    user: { id: data.id, email: data.email, name: data.name, role: data.role },
  }, { status: 201 })
}
