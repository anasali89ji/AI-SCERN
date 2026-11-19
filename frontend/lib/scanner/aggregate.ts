/**
 * Aiscern — Web Scanner aggregation contract (SCAN-AGG-1)
 *
 * Site-level percentages are derived from each page's VERDICT — the same
 * thresholds that drive per-page cards (aiScore >= 0.65 AI, <= 0.35 HUMAN,
 * else UNCERTAIN, per lib/scanner/engines.ts) — so the summary, heatmap and
 * page cards can never disagree. Before this module the route re-derived
 * "AI share" from raw scores with a DIFFERENT threshold (>= 0.5), silently
 * counting every 0.5–0.65 UNCERTAIN page as AI in the headline number.
 */
import type { ScannedPage, ScannedImage } from './types'

export interface VerdictMix {
  /** % of analyzed pages whose verdict is AI (0–100, 1 decimal) */
  aiContentPercent: number
  /** % of analyzed pages whose verdict is HUMAN (0–100, 1 decimal) */
  humanContentPercent: number
  /** % of analyzed pages whose verdict is UNCERTAIN (0–100, 1 decimal) */
  uncertainContentPercent: number
  /** number of pages analyzed (denominator) */
  analyzedPages: number
  /** pages whose analysis failed — excluded from the mix, reported honestly */
  failedPages: number
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 1000) / 10
}

export function aggregateVerdictMix(pages: ScannedPage[]): VerdictMix {
  const analyzed = pages.filter(p => p.verdict !== undefined && p.verdict !== null)
  const failed = pages.length - analyzed.length
  const ai = analyzed.filter(p => p.verdict === 'AI').length
  const human = analyzed.filter(p => p.verdict === 'HUMAN').length
  const uncertain = analyzed.filter(p => p.verdict === 'UNCERTAIN').length

  return {
    aiContentPercent: pct(ai, analyzed.length),
    humanContentPercent: pct(human, analyzed.length),
    uncertainContentPercent: pct(uncertain, analyzed.length),
    analyzedPages: analyzed.length,
    failedPages: failed,
  }
}

/** % of analyzed images whose verdict is AI (0–100, 1 decimal). */
export function aiImagePercent(images: ScannedImage[]): number {
  const analyzed = images.filter(i => i.verdict !== undefined && i.verdict !== null)
  return pct(analyzed.filter(i => i.verdict === 'AI').length, analyzed.length)
}

/**
 * Convert a 0–1 model score to a 0–100 percentage for DISPLAY (SCAN-UI-1).
 * Engines (analyzeText, analyzeImageForensics, computeContentOriginality,
 * buildSiteTrustScore, computeVoiceDiversityIndex, analyzeDuplicity) all
 * emit 0–1; the scraper UI previously printed the raw value next to a '%'
 * sign, so a 65%-AI page showed as "1%". All display sites go through this
 * helper now, and it is unit-tested at the exact verdict boundaries.
 */
export function toDisplayPercent(score01: number | null | undefined): number {
  if (typeof score01 !== 'number' || !Number.isFinite(score01)) return 0
  return Math.round(Math.min(1, Math.max(0, score01)) * 100)
}
