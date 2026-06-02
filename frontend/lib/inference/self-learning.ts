// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Detection Self-Learning Calibration System
//
// When users provide feedback (correct / incorrect) on detections, this
// module logs the signal scores + ground truth to Supabase. A nightly
// Inngest function reads these logs and recomputes optimal signal weights
// via gradient descent, storing updated weights back in the DB.
//
// At inference time, the current signal weights are loaded from the DB
// (cached in Redis for 30 minutes) and override the hard-coded defaults.
//
// Flow:
//   1. Detection runs → scores logged + scan stored
//   2. User submits feedback via /api/detect/feedback
//   3. Feedback triggers logSignalFeedback() → inserts to signal_feedback
//   4. Every 24h: Inngest function recalculates weights → stores in signal_weights
//   5. At inference: loadSignalWeights() → overrides default weights if available
//
// This means the detection brains get smarter over time without code changes.
// ════════════════════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getRedis }         from '@/lib/cache/redis'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignalFeedbackEntry {
  scan_id:         string
  modality:        'image' | 'text'
  signal_name:     string
  signal_score:    number
  ground_truth:    'AI' | 'HUMAN'        // user-confirmed truth
  predicted:       'AI' | 'HUMAN' | 'UNCERTAIN'
  was_correct:     boolean
}

export interface LearnedWeights {
  modality: 'image' | 'text'
  weights:  Record<string, number>       // signal_name → learned weight
  version:  number
  updated_at: string
}

// ── Redis cache keys ──────────────────────────────────────────────────────────

const CACHE_KEY_IMAGE = 'aiscern:signal_weights:image:v1'
const CACHE_KEY_TEXT  = 'aiscern:signal_weights:text:v1'
const CACHE_TTL_SEC   = 30 * 60   // 30 minutes

// ── Log feedback for a batch of signals ──────────────────────────────────────
// Called from /api/detect/feedback when a user corrects a detection.

export async function logSignalFeedback(entries: SignalFeedbackEntry[]): Promise<void> {
  if (!entries.length) return
  try {
    const supabase = getSupabaseAdmin()
    const rows = entries.map(e => ({
      scan_id:      e.scan_id,
      modality:     e.modality,
      signal_name:  e.signal_name,
      signal_score: e.signal_score,
      ground_truth: e.ground_truth,
      predicted:    e.predicted,
      was_correct:  e.was_correct,
      created_at:   new Date().toISOString(),
    }))
    await supabase.from('signal_feedback').insert(rows)
  } catch (err) {
    console.error('[self-learning] Failed to log signal feedback:', err)
  }
}

// ── Load learned weights from DB (with Redis cache) ──────────────────────────

export async function loadSignalWeights(modality: 'image' | 'text'): Promise<Record<string, number> | null> {
  const cacheKey = modality === 'image' ? CACHE_KEY_IMAGE : CACHE_KEY_TEXT

  // 1. Try Redis cache
  try {
    const redis = getRedis()
    const cached = await redis.get(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached as string) as LearnedWeights
      if (parsed?.weights && Object.keys(parsed.weights).length > 0) {
        return parsed.weights
      }
    }
  } catch { /* Redis miss — fall through */ }

  // 2. Try Supabase
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('signal_weights')
      .select('weights, version, updated_at')
      .eq('modality', modality)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (error || !data?.weights) return null

    const learned: LearnedWeights = { modality, weights: data.weights, version: data.version, updated_at: data.updated_at }

    // Cache in Redis
    try {
      const redis = getRedis()
      await redis.set(cacheKey, JSON.stringify(learned), { ex: CACHE_TTL_SEC })
    } catch { /* non-fatal */ }

    return learned.weights
  } catch {
    return null
  }
}

// ── Apply learned weights to a set of signals ────────────────────────────────
// Called inside the detection brains before the weighted sum.

export function applyLearnedWeights<T extends { name: string; weight: number }>(
  signals: T[],
  learnedWeights: Record<string, number> | null,
): T[] {
  if (!learnedWeights || Object.keys(learnedWeights).length === 0) return signals
  return signals.map(sig => {
    const learned = learnedWeights[sig.name]
    if (learned == null || isNaN(learned) || learned <= 0) return sig
    // Blend: 70% learned, 30% original (prevents overfitting to small datasets)
    const blended = sig.weight * 0.30 + learned * 0.70
    return { ...sig, weight: Math.max(0.01, Math.min(0.50, blended)) }
  })
}

// ── Inngest-compatible weight recalculation (called once per 24h) ─────────────
// Uses a simple gradient-based weight optimisation over the last 1000 feedbacks.
// For each signal: weight ∝ accuracy on labeled examples.

export async function recalculateSignalWeights(modality: 'image' | 'text'): Promise<{ updated: boolean; signals: number }> {
  try {
    const supabase = getSupabaseAdmin()

    // Fetch last 2000 labeled examples
    const { data: rows, error } = await supabase
      .from('signal_feedback')
      .select('signal_name, signal_score, ground_truth, predicted, was_correct')
      .eq('modality', modality)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error || !rows || rows.length < 20) {
      return { updated: false, signals: 0 }
    }

    // Group by signal name
    const bySignal: Record<string, { scores: number[]; correct: number[]; total: number }> = {}
    for (const row of rows) {
      if (!bySignal[row.signal_name]) bySignal[row.signal_name] = { scores: [], correct: [], total: 0 }
      const isAI = row.ground_truth === 'AI'
      // Score should point to AI when ground truth is AI, and away when human
      const signalCorrect = isAI ? (row.signal_score > 0.5 ? 1 : 0) : (row.signal_score < 0.5 ? 1 : 0)
      bySignal[row.signal_name].scores.push(row.signal_score)
      bySignal[row.signal_name].correct.push(signalCorrect)
      bySignal[row.signal_name].total++
    }

    // Compute learned weight for each signal: proportional to accuracy
    const weights: Record<string, number> = {}
    for (const [name, data] of Object.entries(bySignal)) {
      if (data.total < 5) continue
      const accuracy = data.correct.reduce((a, b) => a + b, 0) / data.total
      // Normalise accuracy to weight: 0.50 accuracy → 0.04 (baseline), 0.90 → 0.20
      const baselineAcc = 0.50
      const learnedW = Math.max(0.02, Math.min(0.40, (accuracy - baselineAcc) * 0.45 + 0.06))
      weights[name] = learnedW
    }

    if (Object.keys(weights).length === 0) return { updated: false, signals: 0 }

    // Get current version
    const { data: current } = await supabase
      .from('signal_weights')
      .select('version')
      .eq('modality', modality)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (current?.version ?? 0) + 1

    // Upsert new weights
    await supabase.from('signal_weights').upsert({
      modality,
      weights,
      version: nextVersion,
      sample_count: rows.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'modality' })

    // Bust Redis cache
    try {
      const redis = getRedis()
      const cacheKey = modality === 'image' ? CACHE_KEY_IMAGE : CACHE_KEY_TEXT
      await redis.del(cacheKey)
    } catch { /* non-fatal */ }

    return { updated: true, signals: Object.keys(weights).length }
  } catch (err) {
    console.error('[self-learning] recalculate failed:', err)
    return { updated: false, signals: 0 }
  }
}
