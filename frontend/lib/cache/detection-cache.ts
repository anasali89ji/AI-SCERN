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

/**
 * SHA-256 content hash for cache keys.
 *
 * CACHE-IMG-1 / CACHE-AUD-1 (audit 2026-11): callers previously passed
 * `buffer.subarray(0, 65536)` — only the first 64 KiB contributed to the
 * hash, so two DIFFERENT files sharing a header (same camera profile +
 * embedded thumbnail, re-saved edits, large ICC/EXIF blocks, concatenated
 * containers) collided and the cache served the wrong verdict. Callers now
 * pass the complete buffer and this helper bounds the CPU cost itself:
 *   - <= 32 MB : SHA-256 over the entire buffer (images are capped at 10 MB)
 *   - >  32 MB : length + head 1 MB + tail 1 MB + 64 evenly spaced 16 KB
 *               samples (bounded CPU for large audio; length + spread
 *               samples make accidental collisions negligible)
 * Mirrors lib/cache/scan-cache.ts hashBuffer.
 */
const FULL_HASH_LIMIT = 32 * 1024 * 1024

export function contentHash(content: string | Buffer): string {
  const input = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  const h = createHash('sha256')
  if (input.length <= FULL_HASH_LIMIT) {
    h.update(input as unknown as string)
  } else {
    const MB = 1024 * 1024
    h.update(`len:${input.length}:`)
    h.update(input.subarray(0, MB) as unknown as string)
    h.update(input.subarray(input.length - MB) as unknown as string)
    const step = Math.floor((input.length - 2 * MB) / 64)
    for (let i = 0; i < 64; i++) {
      const start = MB + i * step
      h.update(input.subarray(start, start + 16384) as unknown as string)
    }
  }
  return h.digest('hex').slice(0, 40)
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
