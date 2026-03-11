import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession, getClientIp } from './auth'

export function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function requireAdmin(req: NextRequest): Promise<{ ip: string } | NextResponse> {
  const token = req.cookies.get('admin_session')?.value
  const ip = getClientIp(req)
  const valid = await verifyAdminSession(token)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { ip }
}

export async function logAdminAction(action: string, targetUserId: string | null, ip: string, metadata: object = {}) {
  try {
    const db = getAdminDb()
    await db.from('admin_audit_log').insert({ action, target_user_id: targetUserId, admin_ip: ip, metadata })
  } catch {}
}
