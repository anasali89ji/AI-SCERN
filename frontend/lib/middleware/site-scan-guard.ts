/**
 * Site Scan Guard — Web Scanner (/api/scanner) credit gate
 *
 * FIX: /api/scanner previously had no auth check and no credit guard at
 * all (only a 5-per-minute-per-IP in-memory limiter that resets on every
 * deploy). This mirrors the conventions of lib/middleware/credit-guard.ts
 * but tracks its own daily counter via check_and_increment_site_scan(),
 * so the Web Scanner's 5-scans/day free-tier cap never collides with the
 * general text/image/audio/video daily quota.
 *
 * SCAN-QUOTA-1 (audit 2026-11): the guard originally ran BEFORE the scan-cache
 * lookup and the RPC increments the daily counter unconditionally — a cache
 * hit burned a paid scan credit without performing any work. The route now
 * authenticates first (getSiteScanUser), resolves plan caps without mutating
 * anything (getSiteScanPlanContext), checks the cache, and only calls the
 * incrementing siteScanGuard() on a cache miss.
 *
 * SCAN-GUARD-1 (audit 2026-11): an RPC failure used to fail OPEN with a
 * permissive free/5/0 fallback — an attacker able to induce RPC errors
 * (or a real outage) got unlimited free scans with no plan caps. Quota
 * enforcement is billing-critical and now fails CLOSED with a 503 and a
 * retryable error. Legitimate users see a clear "try again" message; the
 * rate limiter still bounds retry pressure.
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
  // Module 4.7: per-plan max pages/images per scan (was: missing — server
  // couldn't enforce "Pro = 500 pages per scan"). Now: clamped in /api/scanner.
  maxPagesPerScan?:  number
  maxImagesPerScan?: number
}

interface SiteScanRpcResult {
  allowed:     boolean
  reason:      string
  plan:        string
  daily_scans: number
  daily_limit: number
  // Module 4.7: new fields returned by the updated RPC (v36 migration)
  max_pages_per_scan?: number
  max_images_per_scan?: number
}

/**
 * Per-plan Web Scanner caps. MUST mirror the CASE branches in
 * supabase/migrations/v36_site_scan_plan_tiers.sql (check_and_increment_site_scan).
 * Drift here only affects cache-key scoping and pre-RPC display, never the
 * enforced quota (the RPC re-derives and returns its own caps).
 */
export const SITE_SCAN_PLAN_CAPS: Record<string, { pages: number; images: number; daily: number }> = {
  free:       { pages: 30,   images: 40,  daily: 5 },
  starter:    { pages: 150,  images: 100, daily: 25 },
  pro:        { pages: 500,  images: 150, daily: 100 },
  enterprise: { pages: 5000, images: 500, daily: -1 },
}

export function siteScanCapsForPlan(plan: string): { pages: number; images: number; daily: number } {
  return SITE_SCAN_PLAN_CAPS[plan] ?? SITE_SCAN_PLAN_CAPS.free
}

/** Step 1 — authenticate only. No DB access, no quota mutation. */
export async function getSiteScanUser(_req: NextRequest): Promise<{ userId: string }> {
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
  return { userId }
}

/**
 * Step 2 — resolve the user's plan + caps WITHOUT incrementing the daily
 * counter. Used by /api/scanner to scope the scan-cache key to the user's
 * plan entitlement before deciding whether a fresh (quota-consuming) scan
 * is needed. Failures return the free-tier caps (conservative, never
 * over-grants) and are non-fatal.
 */
export async function getSiteScanPlanContext(userId: string): Promise<SiteScanGuardResult> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  const plan = (!error && data?.plan) ? data.plan : 'free'
  const caps = siteScanCapsForPlan(plan)
  return {
    userId,
    plan,
    dailyScans: 0,
    dailyLimit: caps.daily,
    unlimited: caps.daily === -1,
    maxPagesPerScan:  caps.pages,
    maxImagesPerScan: caps.images,
  }
}

/**
 * Current daily usage WITHOUT incrementing (for cache-hit response headers).
 * Returns 0 when the usage row is missing or unreadable.
 */
export async function getSiteScanDailyUsage(userId: string): Promise<number> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('user_site_scan_counts')
    .select('daily_count')
    .eq('user_id', userId)
    .eq('scan_date', new Date().toISOString().slice(0, 10))
    .maybeSingle()
  if (error || !data) return 0
  return Number(data.daily_count ?? 0)
}

/** Full quota check — increments the daily counter. Call only on a cache miss. */
export async function siteScanGuard(req: NextRequest): Promise<SiteScanGuardResult> {
  const { userId } = await getSiteScanUser(req)

  const db = getSupabaseAdmin()
  const { data, error } = await db.rpc('check_and_increment_site_scan', { p_user_id: userId })

  if (error) {
    console.error('[siteScanGuard] RPC error:', error.message)
    // SCAN-GUARD-1: fail CLOSED. The old permissive fallback (free/0-of-5)
    // silently granted unlimited scans with no plan caps whenever the RPC
    // errored — quota enforcement must not depend on the quota store being
    // healthy. 503 (not 429/402): this is a service fault, not the user's
    // quota state, and clients should retry later, not upgrade.
    throw new HTTPError(503, 'Scan quota service is temporarily unavailable. Please try again in a moment.', {
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      retryable: true,
    })
  }

  const result = (Array.isArray(data) ? data[0] : data) as SiteScanRpcResult | null
  if (!result) {
    throw new HTTPError(503, 'Scan quota service is temporarily unavailable. Please try again in a moment.', {
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      retryable: true,
    })
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
    // Module 4.7: pass through per-plan page/image caps
    maxPagesPerScan:  result.max_pages_per_scan ?? 30,
    maxImagesPerScan: result.max_images_per_scan ?? 40,
  }
}
