/**
 * Site Scan Guard — Web Scanner (/api/scanner) credit gate
 *
 * FIX: /api/scanner previously had no auth check and no credit guard at
 * all (only a 5-per-minute-per-IP in-memory limiter that resets on every
 * deploy). This mirrors the conventions of lib/middleware/credit-guard.ts
 * but tracks its own daily counter via check_and_increment_site_scan(),
 * so the Web Scanner's 5-scans/day free-tier cap never collides with the
 * general text/image/audio/video daily quota.
 */
import { NextRequest }      from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { HTTPError }        from '@/lib/middleware/credit-guard'

export interface SiteScanGuardResult {
  userId:     string
  plan:       string
  dailyScans: number
  dailyLimit: number
  unlimited?: boolean
}

interface SiteScanRpcResult {
  allowed:     boolean
  reason:      string
  plan:        string
  daily_scans: number
  daily_limit: number
}

export async function siteScanGuard(_req: NextRequest): Promise<SiteScanGuardResult> {
  let userId: string | null = null
  try {
    const session = await auth()
    userId = session?.userId ?? null
  } catch { /* Clerk unavailable */ }

  if (!userId) {
    throw new HTTPError(401, 'Sign in to use the Web Scanner.', {
      code:        'AUTH_REQUIRED',
      upgrade_url: '/signup',
    })
  }

  const db = getSupabaseAdmin()
  const { data, error } = await db.rpc('check_and_increment_site_scan', { p_user_id: userId })

  if (error) {
    console.error('[siteScanGuard] RPC error:', error.message)
    // Fail open — an infrastructure hiccup shouldn't block a legitimate user
    return { userId, plan: 'free', dailyScans: 0, dailyLimit: 5 }
  }

  const result = (Array.isArray(data) ? data[0] : data) as SiteScanRpcResult | null
  if (!result) {
    return { userId, plan: 'free', dailyScans: 0, dailyLimit: 5 }
  }

  if (!result.allowed) {
    throw new HTTPError(402, `Daily Web Scanner limit reached on your ${result.plan} plan (${result.daily_limit}/day). Resets at midnight, or upgrade for more.`, {
      code:             'DAILY_LIMIT_REACHED',
      plan:             result.plan,
      daily_scans:      result.daily_scans,
      daily_limit:      result.daily_limit,
      upgrade_required: true,
      upgrade_url:      '/dashboard/credits',
    })
  }

  return {
    userId,
    plan:       result.plan,
    dailyScans: result.daily_scans,
    dailyLimit: result.daily_limit,
    unlimited:  result.daily_limit === -1,
  }
}
