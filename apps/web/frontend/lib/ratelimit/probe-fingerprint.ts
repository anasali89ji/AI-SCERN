/**
 * Aiscern — API probing / model-extraction detector
 *
 * The existing limiter (lib/ratelimit/index.ts) caps *volume* per
 * identifier. It does nothing about the actual model-extraction pattern:
 * one identifier (or a rotated pool of them behind the same automation)
 * sending many *near-duplicate* files — same image with one pixel
 * changed, same paragraph with one word swapped — to map exactly where
 * a decision boundary sits. Volume limits alone don't catch this because
 * each individual request looks legitimate.
 *
 * This module tracks, per IP over a rolling window:
 *   1. Content-hash Hamming distance clustering — many submissions whose
 *      perceptual/content hashes are close together (small deliberate
 *      perturbations of the same base file) is the signature of a
 *      boundary-mapping attack, not organic usage.
 *   2. Header entropy — automation tends to reuse an identical
 *      User-Agent/Accept-Language pair across a suspiciously large
 *      request count, or omit headers a real browser always sends.
 *   3. Inter-request timing — near-constant intervals (low jitter)
 *      across many requests indicate a script, not a human clicking.
 *
 * None of these alone should hard-block (all have legitimate
 * explanations — e.g. a QA team testing edge cases). Combined, they
 * produce a score; only escalated scores throttle harder or flag for
 * review. This fails open: any Redis error just skips the check.
 */
import { getRedis } from './index'

export interface ProbeSignal {
  suspicious: boolean
  score:      number          // 0-100, informational — log/alert threshold, not a hard gate by itself
  reasons:    string[]
}

const WINDOW_SECONDS = 600     // 10 min rolling window
const MAX_TRACKED     = 50     // cap memory/Redis usage per key

/** Hamming distance between two equal-length hex hash strings (nibble-wise, close enough for clustering). */
function hexHammingDistance(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  let dist = 0
  for (let i = 0; i < len; i++) {
    const diff = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    dist += diff.toString(2).replace(/0/g, '').length
  }
  return dist + Math.abs(a.length - b.length) * 4
}

/**
 * Call once per detect-API request, after you already have the content
 * hash (contentHash() / perceptual hash you're already computing for
 * caching) and before you do the expensive analysis work. Cheap: one
 * Redis round trip, fails open.
 */
export async function checkProbingPattern(params: {
  ip:           string
  contentHash:  string
  userAgent:    string | null
  acceptLang:   string | null
}): Promise<ProbeSignal> {
  const redis = getRedis()
  if (!redis) return { suspicious: false, score: 0, reasons: [] }

  const reasons: string[] = []
  let score = 0

  try {
    const histKey = `probe:hist:${params.ip}`
    const uaKey   = `probe:ua:${params.ip}`
    const tsKey   = `probe:ts:${params.ip}`

    const [rawHist, uaCount, rawTs] = await Promise.all([
      redis.lrange<string>(histKey, 0, MAX_TRACKED - 1),
      redis.get<number>(uaKey),
      redis.lrange<string>(tsKey, 0, 9),
    ])

    // ── 1. Near-duplicate clustering ─────────────────────────────────────
    if (rawHist && rawHist.length >= 5) {
      const distances = rawHist.map(h => hexHammingDistance(h, params.contentHash))
      const closeCount = distances.filter(d => d <= 8).length   // small perturbation threshold
      if (closeCount >= 4) {
        score += 45
        reasons.push(`${closeCount} near-duplicate submissions in window`)
      }
    }

    // ── 2. Header consistency ────────────────────────────────────────────
    if (!params.userAgent || !params.acceptLang) {
      score += 15
      reasons.push('missing standard browser headers')
    }
    if (uaCount !== null && uaCount >= 30) {
      score += 20
      reasons.push('identical User-Agent reused across high request volume')
    }

    // ── 3. Timing jitter ──────────────────────────────────────────────────
    if (rawTs && rawTs.length >= 5) {
      const times = rawTs.map(Number).sort((a, b) => a - b)
      const gaps  = times.slice(1).map((t, i) => t - times[i])
      const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
      const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length
      const jitterRatio = meanGap > 0 ? Math.sqrt(variance) / meanGap : 1
      if (jitterRatio < 0.15 && meanGap < 5000) {
        score += 20
        reasons.push('near-constant request interval (scripted timing)')
      }
    }

    // ── Record this request for the next check ──────────────────────────
    const pipe = redis.pipeline()
    pipe.lpush(histKey, params.contentHash)
    pipe.ltrim(histKey, 0, MAX_TRACKED - 1)
    pipe.expire(histKey, WINDOW_SECONDS)
    pipe.incr(uaKey)
    pipe.expire(uaKey, WINDOW_SECONDS)
    pipe.lpush(tsKey, Date.now().toString())
    pipe.ltrim(tsKey, 0, 9)
    pipe.expire(tsKey, WINDOW_SECONDS)
    await pipe.exec()
  } catch {
    return { suspicious: false, score: 0, reasons: [] }   // fail open
  }

  return { suspicious: score >= 50, score, reasons }
}
