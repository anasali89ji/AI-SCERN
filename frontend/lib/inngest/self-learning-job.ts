// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Self-Learning Daily Recalibration Job (Inngest)
//
// Runs once every 24 hours. Reads accumulated signal_feedback entries from
// Supabase, computes optimal per-signal weights via accuracy-weighted
// gradient update, and writes them back to signal_weights.
//
// Trigger: cron (daily at 03:00 UTC)
// Manual:  event 'aiscern/self-learning.recalibrate'
// ════════════════════════════════════════════════════════════════════════════

import { inngest }                  from './client'
import { recalculateSignalWeights } from '@/lib/inference/self-learning'
import { getSupabaseAdmin }         from '@/lib/supabase/admin'

// ── Daily recalibration function ──────────────────────────────────────────────

export const selfLearningRecalibrate = inngest.createFunction(
  {
    id:       'self-learning-recalibrate',
    name:     'Daily Signal Weight Recalibration',
    retries:  1,
    triggers: [{ cron: '0 3 * * *' }],
  },
  async ({ step }) => {
    const start = Date.now()

    // Step 1: Recalculate image signal weights
    const imageResult = await step.run('recalibrate-image-weights', async () => {
      return recalculateSignalWeights('image')
    })

    // Step 2: Recalculate text signal weights
    const textResult = await step.run('recalibrate-text-weights', async () => {
      return recalculateSignalWeights('text')
    })

    // Step 3: Log calibration run to Supabase for admin visibility
    await step.run('log-calibration-run', async () => {
      const supabase = getSupabaseAdmin()
      const { error } = await supabase.from('calibration_runs').insert({
        ran_at:        new Date().toISOString(),
        duration_ms:   Date.now() - start,
        image_signals: imageResult.signals,
        text_signals:  textResult.signals,
        image_updated: imageResult.updated,
        text_updated:  textResult.updated,
      })
      if (error) console.warn('[self-learning] Failed to log calibration run:', error.message)
      return { logged: !error }
    })

    return {
      success:       true,
      duration_ms:   Date.now() - start,
      image_weights: imageResult,
      text_weights:  textResult,
    }
  },
)

// ── Manual trigger function (for admin dashboard) ─────────────────────────────

export const selfLearningManualTrigger = inngest.createFunction(
  {
    id:       'self-learning-manual-trigger',
    name:     'Manual Signal Weight Recalibration',
    retries:  0,
    triggers: [{ event: 'aiscern/self-learning.recalibrate' }],
  },
  async ({ event, step }) => {
    const modality = (event.data?.modality as 'image' | 'text' | 'both' | undefined) ?? 'both'
    const results: Record<string, unknown> = {}

    if (modality === 'image' || modality === 'both') {
      results.image = await step.run('recalibrate-image', () => recalculateSignalWeights('image'))
    }

    if (modality === 'text' || modality === 'both') {
      results.text = await step.run('recalibrate-text', () => recalculateSignalWeights('text'))
    }

    return {
      success:      true,
      results,
      triggered_by: (event.data?.triggered_by as string | undefined) ?? 'admin',
    }
  },
)
