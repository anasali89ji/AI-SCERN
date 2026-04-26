/**
 * Quality scoring — v2
 *
 * BUG-FIX #5: base scores were equal to filter thresholds → nothing ever rejected.
 * Fix: base starts at 0.0; each positive signal adds weight; realistic thresholds applied.
 *
 * Text quality signals:
 *   - Minimum length enforced in extractor (>= 150 chars)
 *   - Score starts at 0 and climbs based on meaningful length, word count, sentence count
 *   - Junk detection: excessive repetition, all-caps, garbled encoding
 *
 * Audio/Image/Video: tighter base + meaningful signal gating.
 */

/** Fraction of characters that are repeated from the previous char (detects aaaaa... spam) */
function repetitionRatio(text: string): number {
  if (text.length < 10) return 0
  let reps = 0
  for (let i = 1; i < text.length; i++) {
    if (text[i] === text[i - 1]) reps++
  }
  return reps / text.length
}

/** Fraction of alphabetic characters that are uppercase */
function capsRatio(text: string): number {
  const alpha = text.replace(/[^a-zA-Z]/g, '')
  if (!alpha.length) return 0
  return (alpha.replace(/[^A-Z]/g, '').length) / alpha.length
}

export function qualityText(text: string): number {
  // Hard junk gates — immediate discard
  if (repetitionRatio(text) > 0.35) return 0   // aaaa... spam
  if (capsRatio(text) > 0.80)       return 0   // ALL CAPS junk
  // Check for non-printable / garbled encoding (> 5% non-ASCII-printable)
  const nonPrint = (text.match(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g) ?? []).length
  if (nonPrint / text.length > 0.05) return 0

  // Positive signals — accumulate from 0
  let s = 0.0
  if (text.length >= 150)  s += 0.25   // minimum useful length
  if (text.length >= 400)  s += 0.15   // decent paragraph
  if (text.length >= 1000) s += 0.10   // substantive content
  if (text.length >= 3000) s += 0.05   // long-form

  const words = text.split(/\s+/).filter(w => w.length > 0).length
  if (words >= 30)  s += 0.15
  if (words >= 100) s += 0.10
  if (words >= 300) s += 0.05

  const sentences = (text.match(/[.!?]+[\s\n]/g) ?? []).length
  if (sentences >= 3)  s += 0.10
  if (sentences >= 10) s += 0.05

  // Cap
  return Math.min(0.98, s)
}

export function qualityAudio(durationSeconds?: number, sampleRate?: number): number {
  // Must have a real URL (checked in extractor) and some duration
  if (!durationSeconds || durationSeconds < 1) return 0  // too short to be useful
  let s = 0.0
  if (durationSeconds >= 1)   s += 0.30
  if (durationSeconds >= 3)   s += 0.15
  if (durationSeconds >= 10)  s += 0.15
  if (durationSeconds >= 30)  s += 0.10
  if (sampleRate && sampleRate >= 16000) s += 0.15
  if (sampleRate && sampleRate >= 44100) s += 0.10
  return Math.min(0.98, s)
}

export function qualityImage(width?: number, height?: number): number {
  if (!width || !height) return 0.50   // no resolution data but URL present — keep at baseline
  const px = width * height
  let s = 0.0
  if (px >= 10_000)   s += 0.30   // tiny image (~100×100)
  if (px >= 100_000)  s += 0.20   // ~316×316
  if (px >= 250_000)  s += 0.20   // ~500×500
  if (px >= 500_000)  s += 0.15   // ~707×707
  if (px >= 1_000_000) s += 0.10  // ~1000×1000
  return Math.min(0.98, s)
}

export function qualityVideo(url?: string, durationSeconds?: number): number {
  if (!url) return 0   // no URL → no value; caller already rejects
  let s = 0.30         // valid URL baseline
  if (durationSeconds && durationSeconds >= 2)  s += 0.20
  if (durationSeconds && durationSeconds >= 10) s += 0.20
  if (durationSeconds && durationSeconds >= 30) s += 0.15
  return Math.min(0.98, s)
}
