import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db.from('admin_users').select('id, email, name, role, is_active, last_login_at, created_at').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { email, name, password, role = 'admin' } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const db = getAdminDb()
  const hash = await bcrypt.hash(password, 12)

  const { error } = await db.from('admin_users').insert({
    email,
    name,
    password_hash: hash,
    role,
    is_active: true,
    created_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'admin_user_created',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { email, name, role },
  })

  return NextResponse.json({ ok: true })
}
