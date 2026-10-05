/**
 * Aiscern — Scan Result Cache (Module 5.4)
 *
 * Caches detection results for 24 hours using Redis.
 * Same file submitted twice → instant cached result, no ML re-run.
 * Saves Gemini quota (1500/day free limit) and eliminates HF cold starts.
 */

import { getRedis } from './redis'
import { createHash } from 'crypto'
import type { DetectionResult } from '@/lib/inference/hf-analyze'

const CACHE_TTL_SECONDS = 86400  // 24 hours

/**
 * Content hash used as the scan-cache key.
 *
 * The previous version hashed only the first 64KB, so two DIFFERENT files that share a
 * header (same camera profile + embedded thumbnail, re-saved edits, large ICC/EXIF blocks,
 * concatenated containers) collided and the cache served the wrong verdict. Now:
 *   - <= 32MB : SHA-256 over the entire buffer (images are capped at 10MB)
 *   - >  32MB : length + head 1MB + tail 1MB + 64 evenly spaced 16KB samples (bounded CPU
 *               for large audio/video; length + spread samples make accidental collisions
 *               negligible while keeping hashing cost flat)
 */
const FULL_HASH_LIMIT = 32 * 1024 * 1024

export function hashBuffer(buffer: Buffer): string {
  const h = createHash('sha256')
  if (buffer.length <= FULL_HASH_LIMIT) {
    h.update(buffer as unknown as string)
  } else {
    const MB = 1024 * 1024
    h.update(`len:${buffer.length}:`)
    h.update(buffer.subarray(0, MB) as unknown as string)
    h.update(buffer.subarray(buffer.length - MB) as unknown as string)
    const step = Math.floor((buffer.length - 2 * MB) / 64)
    for (let i = 0; i < 64; i++) {
      const start = MB + i * step
      h.update(buffer.subarray(start, start + 16384) as unknown as string)
    }
  }
  return h.digest('hex').slice(0, 32)   // 128-bit prefix -- sufficient uniqueness
}

/**
 * SHA-256 of text content (for text detection caching).
 * Normalises whitespace first so minor formatting changes don't bust cache.
 */
export function hashText(text: string): string {
  const normalised = text.trim().replace(/\s+/g, ' ').slice(0, 8192)
  return createHash('sha256').update(normalised, 'utf8').digest('hex').slice(0, 32)
}

export async function getCachedScan<T = DetectionResult>(hash: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get<string>(`scan:${hash}`)
    if (!raw) return null
    return typeof raw === 'string' ? (JSON.parse(raw) as T) : (raw as T)
  } catch {
    return null
  }
}

export async function setCachedScan<T = DetectionResult>(
  hash: string,
  result: T,
  ttlSeconds: number = CACHE_TTL_SECONDS,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.setex(`scan:${hash}`, ttlSeconds, JSON.stringify(result))
  } catch { /* cache write failure is always non-fatal */ }
}
