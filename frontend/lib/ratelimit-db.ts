/**
 * Aiscern — Supabase-backed Rate Limiter
 *
 * Uses the existing check_and_increment_rate_limit RPC function
 * (already in supabase/migrations/performance_indexes.sql).
 *
 * Zero Redis commands. Uses the same Supabase connection the app
 * already has open — no additional cost or cold start.
 *
 * Falls back to in-memory map if Supabase is unavailable.
 */
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const _localMap = new Map<string, { count: number; resetAt: number }>()

function localFallback(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const e = _localMap.get(key)
  if (!e || now > e.resetAt) {
    _localMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (e.count >= max) return false
  e.count++
  return true
}

// Limits per endpoint type
const DB_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  text:      { max: 30, windowMinutes: 1 },
  image:     { max: 20, windowMinutes: 1 },
  audio:     { max: 15, windowMinutes: 1 },
  video:     { max: 10, windowMinutes: 1 },
  scraper:   { max:  5, windowMinutes: 1 },
  upload:    { max: 30, windowMinutes: 1 },
  batch:     { max:  3, windowMinutes: 1 },
  anon_scan: { max:  5, windowMinutes: 1440 }, // 24h window
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  reset:     number
  limited:   boolean
}

export async function checkRateLimitDB(
  type: string,
  ip:   string,
): Promise<RateLimitResult> {
  const cfg = DB_LIMITS[type] ?? { max: 20, windowMinutes: 1 }
  const key = `${type}:${ip}`

  try {
    const db = getSupabaseAdmin()
    const { data, error } = await db.rpc('check_and_increment_rate_limit', {
      p_ip:             key,
      p_max:            cfg.max,
      p_window_minutes: cfg.windowMinutes,
    })

    if (error) {
      const allowed = localFallback(key, cfg.max, cfg.windowMinutes * 60 * 1000)
      return { allowed, remaining: allowed ? 1 : 0, reset: Date.now() + 60000, limited: !allowed }
    }

    const allowed = data === true
    return {
      allowed,
      remaining: allowed ? Math.max(0, cfg.max - 1) : 0,
      reset:     Date.now() + cfg.windowMinutes * 60 * 1000,
      limited:   !allowed,
    }
  } catch {
    const allowed = localFallback(key, cfg.max, cfg.windowMinutes * 60 * 1000)
    return { allowed, remaining: 1, reset: Date.now() + 60000, limited: !allowed }
  }
}

// Backward-compatible export for any remaining callers
export function rateLimitResponse() {
  return {
    success: false,
    error: {
      code:    'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please wait before trying again.',
    },
  }
}
