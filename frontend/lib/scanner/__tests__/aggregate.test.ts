import { describe, it, expect } from 'vitest'
import { aggregateVerdictMix, aiImagePercent, toDisplayPercent } from '../aggregate'
import type { ScannedPage, ScannedImage } from '../types'

/** Minimal page fixture — only the fields aggregateVerdictMix reads. */
function page(verdict: ScannedPage['verdict'], aiScore: number): ScannedPage {
  return { verdict, aiScore } as unknown as ScannedPage
}
function image(verdict: ScannedImage['verdict'], aiScore: number): ScannedImage {
  return { verdict, aiScore } as unknown as ScannedImage
}

describe('aggregateVerdictMix (SCAN-AGG-1)', () => {
  it('derives the site mix from page VERDICTS, not raw scores', () => {
    // 4 pages: AI, AI, HUMAN, UNCERTAIN — regardless of exact scores.
    const mix = aggregateVerdictMix([
      page('AI', 0.95),
      page('AI', 0.66),
      page('HUMAN', 0.03),
      page('UNCERTAIN', 0.5),
    ])
    expect(mix.aiContentPercent).toBe(50)
    expect(mix.humanContentPercent).toBe(25)
    expect(mix.uncertainContentPercent).toBe(25)
    expect(mix.analyzedPages).toBe(4)
    expect(mix.failedPages).toBe(0)
  })

  it('does NOT count 0.5-0.65 pages as AI (old >= 0.5 aggregation bug)', () => {
    // Both pages sit between the old aggregation threshold (0.5) and the
    // real AI verdict threshold (0.65) — the old route counted these as AI
    // in the headline percentage while showing UNCERTAIN on their cards.
    const mix = aggregateVerdictMix([page('UNCERTAIN', 0.55), page('UNCERTAIN', 0.64)])
    expect(mix.aiContentPercent).toBe(0)
    expect(mix.uncertainContentPercent).toBe(100)
  })

  it('sums to 100 (within 1-decimal rounding) and handles the empty site', () => {
    // 10 pages: 5 AI / 3 HUMAN / 2 UNCERTAIN = 50 / 30 / 20 exactly.
    // (Each component is independently rounded to 1 decimal, so uneven
    // splits like thirds can sum to 99.9/100.1 — acceptable display drift.)
    const mix = aggregateVerdictMix([
      ...Array.from({ length: 5 }, () => page('AI', 0.9)),
      ...Array.from({ length: 3 }, () => page('HUMAN', 0.1)),
      ...Array.from({ length: 2 }, () => page('UNCERTAIN', 0.5)),
    ])
    expect(mix.aiContentPercent + mix.humanContentPercent + mix.uncertainContentPercent).toBe(100)
    const empty = aggregateVerdictMix([])
    expect(empty.aiContentPercent).toBe(0)
    expect(empty.humanContentPercent).toBe(0)
    expect(empty.analyzedPages).toBe(0)
  })

  it('excludes failed analyses from the denominator and reports them', () => {
    const failed = page(undefined, 0) // analyzeAllPages placeholder on error
    const mix = aggregateVerdictMix([page('AI', 0.9), failed])
    expect(mix.analyzedPages).toBe(1)
    expect(mix.aiContentPercent).toBe(100)
    expect(mix.failedPages).toBe(1)
  })
})

describe('aiImagePercent', () => {
  it('counts AI-verdict images only', () => {
    const p = aiImagePercent([image('AI', 0.9), image('HUMAN', 0.1), image('UNCERTAIN', 0.5)])
    expect(p).toBe(33.3)
  })
  it('returns 0 with no analyzed images (not a fake 0% AI claim)', () => {
    expect(aiImagePercent([])).toBe(0)
  })
})

describe('toDisplayPercent (SCAN-UI-1)', () => {
  it.each([
    [0.03, 3], [0.35, 35], [0.5, 50], [0.65, 65], [0.95, 95],
    [0.655, 66], [1, 100], [0, 0],
  ])('converts 0..1 score %s to %s%%', (score, expected) => {
    expect(toDisplayPercent(score)).toBe(expected)
  })

  it('clamps out-of-range and invalid values instead of printing them', () => {
    expect(toDisplayPercent(1.5)).toBe(100)
    expect(toDisplayPercent(-0.2)).toBe(0)
    expect(toDisplayPercent(null)).toBe(0)
    expect(toDisplayPercent(undefined)).toBe(0)
    expect(toDisplayPercent(Number.NaN)).toBe(0)
  })
})
