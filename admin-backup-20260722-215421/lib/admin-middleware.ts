import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { verifyAdminSession, COOKIE_NAME } from './auth'

let _adminDb: SupabaseClient | null = null

export function getAdminDb(): SupabaseClient {
  if (_adminDb) return _adminDb
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  _adminDb = createClient(url, key, { auth: { persistSession: false } })
  return _adminDb
}

// ── Role-based access control ────────────────────────────────────────────────
export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'viewer'

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['*'],
  admin: [
    'users:read', 'users:write', 'users:ban', 'users:credits', 'users:plan',
    'announcements:read', 'announcements:write', 'announcements:delete',
    'notifications:read', 'notifications:write', 'notifications:broadcast',
    'settings:read', 'settings:write', 'analytics:read', 'revenue:read',
    'support:read', 'support:write', 'apikeys:read', 'apikeys:write',
    'flags:read', 'flags:write', 'errors:read', 'errors:write',
    'pipeline:read', 'pipeline:write', 'marketing:read',
    'security:read', 'security:write', 'audit:read',
    'content_moderation:read', 'content_moderation:write',
    'webhooks:read', 'webhooks:write', 'rate_limits:read',
    'backup:read', 'backup:write', 'scans:read', 'scans:export',
    'branding:read', 'branding:write', 'maintenance:read', 'maintenance:write',
    'admin_users:read',
  ],
  moderator: [
    'users:read', 'users:ban',
    'announcements:read', 'announcements:write',
    'notifications:read', 'notifications:write',
    'support:read', 'support:write',
    'content_moderation:read', 'content_moderation:write',
    'errors:read', 'security:read', 'audit:read',
  ],
  viewer: [
    'users:read', 'announcements:read', 'notifications:read',
    'analytics:read', 'support:read', 'errors:read',
    'security:read', 'audit:read', 'pipeline:read',
    'scans:read',
  ],
}

export function hasPermission(role: AdminRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes('*') || perms.includes(permission)
}

// ── Auth result type ─────────────────────────────────────────────────────────
export interface AuthResult {
  ip: string
  role: AdminRole
  adminId: string
  email: string
}

export async function requireAdmin(
  req: NextRequest,
  requiredPermission?: string
): Promise<AuthResult | NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const valid = await verifyAdminSession(token)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  // Fetch admin details from DB
  const db = getAdminDb()
  const { data: session } = await db
    .from('admin_sessions')
    .select('admin_id')
    .eq('session_token', token)
    .maybeSingle()

  let role: AdminRole = 'admin'
  let adminId = 'unknown'
  let email = 'unknown'

  if (session?.admin_id) {
    adminId = session.admin_id
    const { data: admin } = await db
      .from('admin_users')
      .select('role, email')
      .eq('id', adminId)
      .maybeSingle()
    if (admin) {
      role = (admin.role as AdminRole) || 'admin'
      email = admin.email || 'unknown'
    }
  }

  // Check permission
  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient permissions', required: requiredPermission, role },
      { status: 403 }
    )
  }

  return { ip, role, adminId, email }
}

// ── Maintenance mode check ───────────────────────────────────────────────────
export async function checkMaintenanceMode(): Promise<boolean> {
  try {
    const db = getAdminDb()
    const { data } = await db
      .from('settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle()
    return data?.value === 'true' || data?.value === true
  } catch {
    return false
  }
}

// ── Audit logging ────────────────────────────────────────────────────────────
export async function logAdminAction(
  action: string,
  targetId: string | null,
  ip: string,
  metadata?: Record<string, unknown>,
  adminId?: string
): Promise<void> {
  try {
    await getAdminDb().from('admin_audit_log').insert({
      action,
      admin_id: adminId || null,
      admin_ip: ip,
      metadata: { ...metadata, target_id: targetId },
    })
  } catch (e) {
    console.error('[audit] Failed to log action:', e)
  }
}

// ── Rate limit helper for admin APIs ─────────────────────────────────────────
export async function checkAdminRateLimit(
  ip: string,
  action: string,
  windowMs: number = 60000,
  maxRequests: number = 100
): Promise<{ limited: boolean; remaining: number; resetAt: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return { limited: false, remaining: maxRequests, resetAt: Date.now() + windowMs }
  }

  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url, token })
    const key = `admin_ratelimit:${action}:${ip}`
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000))
    }
    const limited = current > maxRequests
    const ttl = await redis.ttl(key)
    return {
      limited,
      remaining: Math.max(0, maxRequests - current),
      resetAt: Date.now() + (ttl > 0 ? ttl * 1000 : windowMs),
    }
  } catch {
    return { limited: false, remaining: maxRequests, resetAt: Date.now() + windowMs }
  }
}
