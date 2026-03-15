/**
 * DETECTAI — Calibration Client
 * Fetches live calibration stats from the cal-agg worker.
 * Cached in memory for 10 minutes to avoid latency on every detection request.
 */

const CAL_AGG_URL = 'https://detectai-cal-agg.saghirahmed9067.workers.dev/calibration'

export interface CalibrationStats {
  entropy_ai_mean:    number; entropy_ai_std:    number
  entropy_real_mean:  number; entropy_real_std:  number
  noise_ai_mean:      number; noise_ai_std:      number
  noise_real_mean:    number; noise_real_std:    number
  luminance_ai_mean:  number; luminance_ai_std:  number
  luminance_real_mean:number; luminance_real_std:number
  bg_ai_mean:         number; bg_ai_std:         number
  bg_real_mean:       number; bg_real_std:       number
  color_ai_mean:      number; color_ai_std:      number
  color_real_mean:    number; color_real_std:    number
  compression_ai_mean:  number; compression_ai_std:  number
  compression_real_mean:number; compression_real_std:number
  ai_sample_count:    number
  real_sample_count:  number
  updated_at:         string
}

// In-memory cache — avoids per-request latency
let _cache:    CalibrationStats | null = null
let _cachedAt: number                  = 0
const CACHE_TTL_MS = 10 * 60 * 1000   // 10 minutes

export async function getCalibrationStats(): Promise<CalibrationStats | null> {
  const now = Date.now()
  if (_cache && (now - _cachedAt) < CACHE_TTL_MS) return _cache

  try {
    const res = await fetch(CAL_AGG_URL, { signal: AbortSignal.timeout(3_000) })
    if (!res.ok) return _cache  // return stale cache on error
    const data = await res.json() as { ok: boolean; data: CalibrationStats }
    if (data.ok && data.data) {
      _cache    = data.data
      _cachedAt = now
      return _cache
    }
  } catch {
    // Network error — return stale cache or null
  }
  return _cache
}

/**
 * Score a signal value using z-score comparison to AI vs Real distributions.
 * Returns 0–1 probability of being AI-generated.
 *
 * Uses the normal distribution CDF approximation:
 * P(AI) = sigmoid( (z_real - z_ai) * sensitivity )
 */
export function calibratedScore(
  value: number,
  aiMean: number, aiStd: number,
  realMean: number, realStd: number,
  sensitivity = 1.5,
): number {
  const zAI   = (value - aiMean)   / Math.max(aiStd, 0.001)
  const zReal = (value - realMean) / Math.max(realStd, 0.001)
  // Distance from AI distribution vs real distribution
  // Closer to AI mean → higher score
  const distAI   = Math.abs(zAI)
  const distReal = Math.abs(zReal)
  const logit    = (distReal - distAI) * sensitivity
  // Sigmoid
  return 1 / (1 + Math.exp(-logit))
}
