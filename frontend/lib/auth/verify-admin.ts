/**
 * Aiscern — Server-side admin role verification
 *
 * Admin routes MUST call verifyAdmin() before any data access.
 * Role is stored in Clerk publicMetadata: { role: "ADMIN" | "OWNER" | ... }
 *
 * Env: ADMIN_USER_IDS  — comma-separated Clerk user IDs always treated as admin
 *      (emergency fallback if metadata not yet set)
 *
 * SEC-02 FIX: Rate limiting (10/min per userId) added inside verifyAdmin so all
 * admin routes are protected without touching each route individually.
 */
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

const ADMIN_ROLES = new Set(['ADMIN', 'OWNER', 'EXECUTIVE', 'MANAGER', 'ANALYST', 'MARKETING', 'SUPPORT'])

export interface AdminVerifyResult {
  userId: string
  role: string
}

export async function verifyAdmin(): Promise<AdminVerifyResult | NextResponse> {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SEC-02: Rate limit admin routes at 10 requests/min per userId to prevent
    // credential-stuffing attacks from hammering /api/admin/* endpoints
    const adminRl = await checkRateLimit('admin', userId)
    if (adminRl.limited) {
      return NextResponse.json(
        { error: 'Too many admin requests — slow down' },
        { status: 429, headers: { 'X-RateLimit-Reset': String(adminRl.reset) } }
      )
    }

    // Check Clerk publicMetadata role
    const meta = (sessionClaims as any)?.publicMetadata ?? {}
    const role = (meta.role as string | undefined)?.toUpperCase() ?? ''

    // Fallback: env-listed admin user IDs
    const allowedIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)

    if (!ADMIN_ROLES.has(role) && !allowedIds.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }

    return { userId, role: role || 'ADMIN' }
  } catch (err) {
    return NextResponse.json({ error: 'Auth error' }, { status: 401 })
  }
}

/** Convenience: returns true if result is an error response */
export function isAdminError(r: AdminVerifyResult | NextResponse): r is NextResponse {
  return r instanceof NextResponse
}
