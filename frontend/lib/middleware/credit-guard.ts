import { NextRequest, NextResponse } from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'

export interface CreditGuardResult {
  userId:           string
  creditsRemaining: number
  plan:             string
  dailyScans:       number
  dailyLimit:       number
  unlimited?:       boolean
}

export class HTTPError extends Error {
  constructor(public status: number, message: string, public body?: object) {
    super(message)
  }
}

// Plan limits (mirrors plan_limits table — used for anon fallback without DB call)
const PLAN_LIMITS: Record<string, { daily: number; modalities: string[] }> = {
  free:       { daily: 10,  modalities: ['text', 'image'] },
  pro:        { daily: 100, modalities: ['text', 'image', 'audio', 'video', 'url'] },
  team:       { daily: 500, modalities: ['text', 'image', 'audio', 'video', 'url'] },
  enterprise: { daily: -1,  modalities: ['text', 'image', 'audio', 'video', 'url'] },
}

export async function creditGuard(
  req:      NextRequest,
  scanType: string,
): Promise<CreditGuardResult> {
  // ── Authenticated user ─────────────────────────────────────────────────────
  try {
    const { userId } = await auth()
    if (userId) {
      const db    = getSupabaseAdmin()
      const media = scanType  // e.g. 'text', 'image', 'audio', 'video', 'url'

      // Atomic check + increment via DB function
      const { data, error } = await db.rpc('check_and_increment_scan', {
        p_user_id:    userId,
        p_media_type: media,
      })

      if (error) {
        // DB error — fail open but log it (don't block user on our error)
        console.error('[creditGuard] DB error:', error.message)
        return { userId, creditsRemaining: 1, plan: 'free', dailyScans: 0, dailyLimit: 10 }
      }

      const result = data as {
        allowed: boolean; reason: string; plan: string
        daily_scans: number; daily_limit: number; upgrade_required: boolean
      }

      if (!result.allowed) {
        const reason = result.reason === 'modality_not_included'
          ? `Your ${result.plan} plan does not include ${media} detection. Upgrade to Pro to unlock all modalities.`
          : result.reason === 'modality_credits_exhausted'
            ? `You've used all 3 free ${media} detection credits. Upgrade to Pro for unlimited ${media} detection.`
            : `Daily scan limit reached (${result.daily_scans}/${result.daily_limit}). Resets every 24 hours.`

        const code = result.reason === 'modality_not_included' ? 'MODALITY_LOCKED'
          : result.reason === 'modality_credits_exhausted' ? 'CREDITS_EXHAUSTED'
          : 'DAILY_LIMIT_REACHED'

        throw new HTTPError(402, reason, {
          code,
          plan:             result.plan,
          daily_scans:      result.daily_scans,
          daily_limit:      result.daily_limit,
          upgrade_required: true,
          upgrade_url:      '/pricing',
        })
      }

      const limit   = PLAN_LIMITS[result.plan]?.daily ?? 10
      const isUnlimited = limit === -1

      return {
        userId,
        plan:             result.plan,
        dailyScans:       result.daily_scans,
        dailyLimit:       result.daily_limit,
        creditsRemaining: isUnlimited ? 999999 : Math.max(0, result.daily_limit - result.daily_scans),
        unlimited:        isUnlimited,
      }
    }
  } catch (err) {
    if (err instanceof HTTPError) throw err
    // Clerk auth error — fall through to anon
  }

  // ── Anonymous user — IP rate limiting ─────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous'

  // Anon: only text/image, hard 5/day enforced via Redis
  if (!['text', 'image'].includes(scanType)) {
    throw new HTTPError(401, 'Sign in to use audio, video, and web scanning.', {
      code: 'AUTH_REQUIRED', upgrade_url: '/signup',
    })
  }

  const rl = await checkRateLimit('anon_scan', ip)
  if (rl.limited) {
    throw new HTTPError(429, 'Anonymous scan limit reached. Sign in for 10 free scans per day.', {
      code: 'ANON_LIMIT_REACHED', upgrade_url: '/signup',
    })
  }

  return {
    userId:           `anon_${ip}`,
    plan:             'anon',
    dailyScans:       0,
    dailyLimit:       5,
    creditsRemaining: 5,
  }
}

export function httpErrorResponse(err: HTTPError): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'ERROR', message: err.message, ...err.body } },
    { status: err.status },
  )
}
