import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession, COOKIE_NAME } from './auth'

const PERMISSIONS: Record<string, string[]> = {
  admin: ['users:read', 'users:write', 'scans:read', 'settings:read', 'settings:write'],
  moderator: ['users:read', 'scans:read', 'content:moderate'],
  super_admin: ['*'],
}

export function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin credentials missing')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function requireAdmin(
  req: NextRequest,
  requiredPermission?: string
): Promise<{ adminId: string; ip: string } | NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const isValid = await verifyAdminSession(token)

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract adminId from token payload
  let adminId = 'legacy'
  if (token) {
    const parts = token.split(':')
    if (parts.length >= 4) {
      adminId = parts[parts.length - 1] || 'legacy'
    }
  }

  // Check permissions if required
  if (requiredPermission && requiredPermission !== '*') {
    const db = getAdminDb()
    const { data: admin } = await db.from('admin_users').select('role').eq('id', adminId).single()
    const role = admin?.role || 'admin'
    const allowed = PERMISSIONS[role] || []
    if (!allowed.includes('*') && !allowed.includes(requiredPermission)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 })
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
  return { adminId, ip }
}
