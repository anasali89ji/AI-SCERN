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
 * SHA-256 of first 64KB of buffer.
 * Fast on files up to 500MB, collision-resistant for deduplication.
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256')
    .update(buffer.subarray(0, Math.min(buffer.length, 65536)) as unknown as string)
    .digest('hex')
    .slice(0, 32)   // 32 hex chars = 128-bit prefix — sufficient uniqueness
}

/**
 * SHA-256 of text content (for text detection caching).
 * Normalises whitespace first so minor formatting changes don't bust cache.
 */
export function hashText(text: string): string {
  const normalised = text.trim().replace(/\s+/g, ' ').slice(0, 8192)
  return createHash('sha256').update(normalised, 'utf8').digest('hex').slice(0, 32)
}

export async function getCachedScan(hash: string): Promise<DetectionResult | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get<string>(`scan:${hash}`)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as DetectionResult)
  } catch {
    return null
  }
}

export async function setCachedScan(hash: string, result: DetectionResult): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.setex(`scan:${hash}`, CACHE_TTL_SECONDS, JSON.stringify(result))
  } catch { /* cache write failure is always non-fatal */ }
}
