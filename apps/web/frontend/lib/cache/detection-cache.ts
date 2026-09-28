/**
 * Aiscern — Detection Result Cache
 *
 * Caches identical content results for 1 hour.
 * Prevents repeat Gemini API calls for the same file/text.
 * Uses Upstash Redis. Falls back to no-cache if Redis unavailable.
 */
import { Redis }           from '@upstash/redis'
import { createHash }      from 'crypto'
import type { DetectionResult } from '@/types'

const CACHE_TTL_SECONDS = 3600

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try { _redis = new Redis({ url, token }); return _redis }
  catch { return null }
}

export function contentHash(content: string | Buffer): string {
  const input = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  return createHash('sha256').update(input as unknown as string).digest('hex').slice(0, 40)
}

export async function getCachedDetection(
  type: 'text' | 'image' | 'audio',
  hash: string,
): Promise<DetectionResult | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get<string>(`cache:detect:${type}:${hash}`)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw as DetectionResult
  } catch { return null }
}

export async function setCachedDetection(
  type: 'text' | 'image' | 'audio',
  hash: string,
  result: DetectionResult,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(
      `cache:detect:${type}:${hash}`,
      JSON.stringify(result),
      { ex: CACHE_TTL_SECONDS }
    )
  } catch { /* non-fatal */ }
}
