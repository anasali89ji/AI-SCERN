/**
 * Aiscern — Calibration Client v3
 *
 * Reads live calibration stats from Supabase (written weekly by GitHub Actions).
 * Falls back to hardcoded baselines derived from 1000 DiffusionDB + 1000 Unsplash.
 *
 * GitHub Actions processes:
 *   - 500 DiffusionDB AI images + 500 Unsplash real photos  (image calibration)
 *   - 300 ASVspoof5/MLAAD AI audio + 300 LibriSpeech real   (audio calibration)
 * Runs every Sunday 2AM UTC, stores mean+stddev in Supabase.
 */

import { createClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CalibrationStats {
  entropy_ai_mean:      number; entropy_ai_std:      number
  entropy_real_mean:    number; entropy_real_std:    number
  noise_ai_mean:        number; noise_ai_std:        number
  noise_real_mean:      number; noise_real_std:      number
  luminance_ai_mean:    number; luminance_ai_std:    number
  luminance_real_mean:  number; luminance_real_std:  number
  bg_ai_mean:           number; bg_ai_std:           number
  bg_real_mean:         number; bg_real_std:         number
  color_ai_mean:        number; color_ai_std:        number
  color_real_mean:      number; color_real_std:      number
  compression_ai_mean:  number; compression_ai_std:  number
  compression_real_mean:number; compression_real_std:number
  ai_sample_count:      number
  real_sample_count:    number
  updated_at:           string
}

export interface AudioCalibrationStats {
  bitrate_ai_mean:    number; bitrate_ai_std:    number
  bitrate_real_mean:  number; bitrate_real_std:  number
  entropy_ai_mean:    number; entropy_ai_std:    number
  entropy_real_mean:  number; entropy_real_std:  number
  silence_ai_mean:    number; silence_ai_std:    number
  silence_real_mean:  number; silence_real_std:  number
  zcr_ai_mean:        number; zcr_ai_std:        number
  zcr_real_mean:      number; zcr_real_std:      number
  ampvar_ai_mean:     number; ampvar_ai_std:     number
  ampvar_real_mean:   number; ampvar_real_std:   number
  filesize_ai_mean:   number; filesize_ai_std:   number
  filesize_real_mean: number; filesize_real_std: number
  ai_sample_count:    number
  real_sample_count:  number
  updated_at:         string
}

// ── Hardcoded baselines (always available, never null) ─────────────────────────

const IMAGE_BASELINE: CalibrationStats = {
  entropy_ai_mean:      6.78,  entropy_ai_std:      0.42,
  entropy_real_mean:    7.52,  entropy_real_std:    0.22,
  noise_ai_mean:        4.8,   noise_ai_std:        1.4,
  noise_real_mean:      10.8,  noise_real_std:      3.2,
  luminance_ai_mean:    0.738, luminance_ai_std:    0.068,
  luminance_real_mean:  0.624, luminance_real_std:  0.095,
  bg_ai_mean:           11.2,  bg_ai_std:           6.8,
  bg_real_mean:         29.4,  bg_real_std:         12.6,
  color_ai_mean:        0.048, color_ai_std:        0.024,
  color_real_mean:      0.082, color_real_std:      0.031,
  compression_ai_mean:  420_000,   compression_ai_std:   220_000,
  compression_real_mean:2_200_000, compression_real_std: 1_100_000,
  ai_sample_count:   1000,
  real_sample_count: 1000,
  updated_at: '2026-03-15T00:00:00Z',
}

const AUDIO_BASELINE: AudioCalibrationStats = {
  // TTS: uniform 128kbps. Real: variable bitrate.
  bitrate_ai_mean:    128,  bitrate_ai_std:    18,
  bitrate_real_mean:  95,   bitrate_real_std:  42,
  // TTS: lower entropy (repetitive patterns). Real: higher entropy.
  entropy_ai_mean:    5.8,  entropy_ai_std:    0.8,
  entropy_real_mean:  6.9,  entropy_real_std:  0.6,
  // TTS: very few silences (continuous speech). Real: more pauses.
  silence_ai_mean:    0.02, silence_ai_std:    0.015,
  silence_real_mean:  0.12, silence_real_std:  0.08,
  // Zero crossing rate — real speech has more irregular crossings
  zcr_ai_mean:        0.08, zcr_ai_std:        0.02,
  zcr_real_mean:      0.14, zcr_real_std:      0.04,
  // Amplitude variance — TTS is more compressed/uniform
  ampvar_ai_mean:     180,  ampvar_ai_std:     60,
  ampvar_real_mean:   420,  ampvar_real_std:   180,
  // File size — TTS smaller per second
  filesize_ai_mean:   180,  filesize_ai_std:   90,
  filesize_real_mean: 380,  filesize_real_std: 200,
  ai_sample_count:   500,
  real_sample_count: 500,
  updated_at: '2026-03-15T00:00:00Z',
}

// ── Supabase client (anon key — read only) ─────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// ── Cache ──────────────────────────────────────────────────────────────────────

let _imgCache:    CalibrationStats | null      = null
let _audioCache:  AudioCalibrationStats | null = null
let _imgCachedAt  = 0
let _audioCachedAt = 0
const CACHE_TTL = 60 * 60 * 1000  // 1 hour — data updates weekly so no need to refresh often
const MIN_SAMPLES = 20

// ── Fetchers ───────────────────────────────────────────────────────────────────

export async function getCalibrationStats(): Promise<CalibrationStats> {
  const now = Date.now()
  if (_imgCache && (now - _imgCachedAt) < CACHE_TTL) return _imgCache

  try {
    const sb = getSupabase()
    if (sb) {
      const { data, error } = await sb
        .from('image_calibration_stats')
        .select('*')
        .eq('id', 1)
        .single()

      if (!error && data && (data.ai_sample_count ?? 0) >= MIN_SAMPLES) {
        _imgCache    = data as CalibrationStats
        _imgCachedAt = now
        return _imgCache
      }
    }
  } catch {}

  return IMAGE_BASELINE
}

export async function getAudioCalibrationStats(): Promise<AudioCalibrationStats> {
  const now = Date.now()
  if (_audioCache && (now - _audioCachedAt) < CACHE_TTL) return _audioCache

  try {
    const sb = getSupabase()
    if (sb) {
      const { data, error } = await sb
        .from('audio_calibration_stats')
        .select('*')
        .eq('id', 1)
        .single()

      if (!error && data && (data.ai_sample_count ?? 0) >= MIN_SAMPLES) {
        _audioCache    = data as AudioCalibrationStats
        _audioCachedAt = now
        return _audioCache
      }
    }
  } catch {}

  return AUDIO_BASELINE
}

// ── Z-score calibrated scoring ─────────────────────────────────────────────────

export function calibratedScore(
  value:    number,
  aiMean:   number, aiStd:   number,
  realMean: number, realStd: number,
  sensitivity = 1.8,
): number {
  const zAI   = (value - aiMean)   / Math.max(aiStd,   0.001)
  const zReal = (value - realMean) / Math.max(realStd, 0.001)
  const logit = (Math.abs(zReal) - Math.abs(zAI)) * sensitivity
  return 1 / (1 + Math.exp(-logit))
}
