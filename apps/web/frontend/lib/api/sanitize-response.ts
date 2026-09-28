/**
 * Aiscern — Client-response IP sanitizer
 *
 * Detection signals carry `weight` (the ensemble's per-signal fusion
 * weight) and `value` (the raw 0-1 score) for internal use — DB storage,
 * calibration, ARIA's tool responses. Those two fields are exactly what
 * a scripted caller needs to reconstruct our fusion math: send N probe
 * files, record (weight, value) per named signal per response, solve
 * for the scoring function. Verdict + confidence alone don't leak this;
 * per-signal weight+value pairs do.
 *
 * This module is the single choke point between an internal
 * DetectionResult and anything written into a NextResponse.json() body.
 * It must run AFTER the Supabase insert (which needs full fidelity) and
 * immediately before the response is constructed — never earlier.
 */
import type { DetectionSignal } from '@/lib/inference/hf-analyze'

export interface ClientSafeSignal {
  name:         string
  category:     string
  description:  string
  /** Coarse tier replacing the raw fusion weight. Never the exact number. */
  contribution: 'low' | 'moderate' | 'high'
  flagged:      boolean
}

/** Buckets a raw fusion weight into a 3-tier label. */
function bucketWeight(weight: number): 'low' | 'moderate' | 'high' {
  if (weight >= 40) return 'high'
  if (weight >= 15) return 'moderate'
  return 'low'
}

export function sanitizeSignalsForClient(
  signals: DetectionSignal[] | undefined | null
): ClientSafeSignal[] {
  if (!signals) return []
  return signals.map(s => ({
    name:         s.name,
    category:     s.category,
    description:  s.description,
    contribution: bucketWeight(s.weight),
    flagged:      s.flagged,
  }))
}

/**
 * Strips high-resolution, IP-bearing fields (`weight`, `value`) from a
 * detection result before it goes into a client-facing NextResponse.
 * Everything else (verdict, confidence, findings, generator hints,
 * degraded_signals, rag_stats, timing) is caller-safe as-is — it
 * describes the outcome, not the internal math that produced it.
 */
export function sanitizeDetectionResultForClient<T extends { signals?: DetectionSignal[] | null }>(
  result: T
): Omit<T, 'signals'> & { signals: ClientSafeSignal[] } {
  return {
    ...result,
    signals: sanitizeSignalsForClient(result.signals),
  }
}
