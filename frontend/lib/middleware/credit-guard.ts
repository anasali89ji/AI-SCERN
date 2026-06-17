/**
 * Aiscern — Credit Guard Middleware v3
 *
 * Guards every /api/detect/* route. In order:
 *  1. Clerk auth → identifies user (or anon IP)
 *  2. Calls check_and_increment_scan() — atomic credit + daily-limit check in Supabase
 *  3. For anon users → Redis rate limit (5/day)
 *
 * v3 fixes:
 *   - The DB function now RETURNS JSONB (was RETURNS TABLE). Supabase .rpc()
 *     returns a plain object for JSONB functions — no array unwrapping needed.
 *   - Defensive fallback: if data is still an array (running against old DB
 *     schema before v19 migration), unwrap data[0] automatically.
 *   - user_not_found: auto-creates profile + fails open (handles first-scan
 *     race condition where Clerk redirect fires before profile sync completes).
 *
 * Usage in any /api/detect/* route:
 *   const guard = await creditGuard(req, 'image')  // throws HTTPError on failure
 *   // guard.userId, guard.plan, guard.creditsRemaining available
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit }   from '@/lib/ratelimit'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditGuardResult {
  userId:           string
  creditsRemaining: number
  plan:             string
  dailyScans:       number
  dailyLimit:       number
  unlimited?:       boolean
  overage?:         boolean
}

export class HTTPError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'HTTPError'
  }
}

interface ScanRpcResult {
  allowed:            boolean
  reason:             string
  plan:               string
  daily_scans:        number
  daily_limit:        number
  upgrade_required:   boolean
  credits_remaining?: number
  credit_period_end?: string | null
}

// ── Main guard ────────────────────────────────────────────────────────────────

export async function creditGuard(
  req:      NextRequest,
  scanType: string,
): Promise<CreditGuardResult> {

  // ── Authenticated user path ──────────────────────────────────────────────
  let userId: string | null = null
  try {
    const session = await auth()
    userId = session?.userId ?? null
  } catch {
    // Clerk unavailable → fall through to anon path
  }

  if (userId) {
    const db = getSupabaseAdmin()

    const { data, error } = await db.rpc('check_and_increment_scan', {
      p_user_id:    userId,
      p_media_type: scanType,
    })

    if (error) {
      console.error('[creditGuard] DB RPC error:', error.message)
      // Fail open — infrastructure error should not block user
      return { userId, creditsRemaining: 1, plan: 'free', dailyScans: 0, dailyLimit: 10 }
    }

    // Defensive unwrap: v19+ returns JSONB (plain object); old schema returns
    // RETURNS TABLE (array). Handle both so deploys are zero-downtime.
    const result = (Array.isArray(data) ? data[0] : data) as ScanRpcResult | null

    if (!result) {
      console.error('[creditGuard] RPC returned null — failing open')
      return { userId, creditsRemaining: 1, plan: 'free', dailyScans: 0, dailyLimit: 10 }
    }

    // auto_created = profile was just created inside the DB function
    // user_not_found = old schema (pre-v19); fail open
    if (result.reason === 'auto_created' || result.reason === 'user_not_found') {
      return { userId, creditsRemaining: 10, plan: 'free', dailyScans: 1, dailyLimit: 10 }
    }

    if (!result.allowed) {
      throw new HTTPError(402, buildDenyMessage(result.reason, result.plan, scanType), {
        code:             mapDenyCode(result.reason),
        plan:             result.plan,
        daily_scans:      result.daily_scans,
        daily_limit:      result.daily_limit,
        upgrade_required: true,
        upgrade_url:      '/dashboard/credits',
      })
    }

    const unlimited = result.daily_limit === -1
    return {
      userId,
      plan:             result.plan,
      dailyScans:       result.daily_scans,
      dailyLimit:       result.daily_limit,
      creditsRemaining: result.credits_remaining
        ?? (unlimited ? 999_999 : Math.max(0, result.daily_limit - result.daily_scans)),
      unlimited,
      overage: result.reason === 'credit_overage',
    }
  }

  // ── Anonymous user path ──────────────────────────────────────────────────

  if (!['text', 'image'].includes(scanType)) {
    throw new HTTPError(401, `Sign in to use ${scanType} detection.`, {
      code:        'AUTH_REQUIRED',
      upgrade_url: '/sign-up',
    })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? req.headers.get('cf-connecting-ip')
          ?? 'unknown'

  const rl = await checkRateLimit('anon_scan', ip)
  if (rl.limited) {
    throw new HTTPError(429, 'Anonymous scan limit reached. Sign in for 10 free scans per day.', {
      code:        'ANON_LIMIT_REACHED',
      upgrade_url: '/sign-up',
      reset_at:    rl.reset,
    })
  }

  return {
    userId:           `anon_${ip}`,
    plan:             'anon',
    dailyScans:       rl.current ?? 0,
    dailyLimit:       5,
    creditsRemaining: Math.max(0, 5 - (rl.current ?? 0)),
  }
}

// ── Response helpers ──────────────────────────────────────────────────────────

export function httpErrorResponse(err: HTTPError): NextResponse {
  return NextResponse.json(
    { success: false, error: { message: err.message, ...err.body } },
    { status: err.status },
  )
}

export function injectGuardHeaders(response: NextResponse, guard: CreditGuardResult): NextResponse {
  response.headers.set('X-Credits-Remaining', String(guard.creditsRemaining))
  response.headers.set('X-Daily-Scans',       String(guard.dailyScans))
  response.headers.set('X-Plan',              guard.plan)
  if (guard.unlimited) response.headers.set('X-Plan-Unlimited', 'true')
  if (guard.overage)   response.headers.set('X-Credit-Overage', 'true')
  return response
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildDenyMessage(reason: string, plan: string, scanType: string): string {
  switch (reason) {
    case 'modality_not_included':
      return `Your ${plan} plan does not include ${scanType} detection. Upgrade to unlock all scan types.`
    case 'modality_credits_exhausted':
      return `You've used all your ${plan} credits. Purchase more to continue scanning.`
    case 'daily_limit_reached':
      return `Daily scan limit reached on your ${plan} plan. Resets at midnight PKT, or purchase more credits.`
    case 'user_not_found':
      return 'Account not found. Please sign out and sign in again.'
    default:
      return 'Scan limit reached. Upgrade your plan or purchase more credits.'
  }
}

function mapDenyCode(reason: string): string {
  const map: Record<string, string> = {
    modality_not_included:      'MODALITY_LOCKED',
    modality_credits_exhausted: 'CREDITS_EXHAUSTED',
    daily_limit_reached:        'DAILY_LIMIT_REACHED',
    user_not_found:             'USER_NOT_FOUND',
  }
  return map[reason] ?? 'LIMIT_REACHED'
}
