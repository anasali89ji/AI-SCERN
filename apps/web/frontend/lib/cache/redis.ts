import { Redis } from '@upstash/redis'

let _client: Redis | null = null

export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!_client) {
    _client = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _client
}

/**
 * Distributed rate limiter — Redis sliding window with in-process fallback.
 * Returns true if request is allowed, false if rate limited.
 */
const _fallbackMap = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimitRedis(
  ip: string,
  limit = 20,
  windowSeconds = 60,
): Promise<boolean> {
  const redis = getRedis()

  if (!redis) {
    // In-memory fallback (dev / Redis not configured)
    const now = Date.now()
    const e = _fallbackMap.get(ip)
    if (!e || now > e.resetAt) {
      _fallbackMap.set(ip, { count: 1, resetAt: now + windowSeconds * 1000 })
      return true
    }
    if (e.count >= limit) return false
    e.count++
    return true
  }

  try {
    const key      = `rl:${ip}`
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, windowSeconds)
    const results = await pipeline.exec()
    const count   = results[0] as number
    return count <= limit
  } catch {
    return true // Redis error — fail open
  }
}
