// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Self-Learning Daily Recalibration Job (Inngest)
//
// Runs once every 24 hours. Reads accumulated signal_feedback entries from
// Supabase, computes optimal per-signal weights via accuracy-weighted
// gradient update, and writes them back to signal_weights.
//
// This makes the detection brains smarter over time as users correct
// false positives and false negatives.
//
// Trigger: inngest/cron (daily at 03:00 UTC)
// ════════════════════════════════════════════════════════════════════════════

import { inngest }                       from './client'
import { recalculateSignalWeights }      from '@/lib/inference/self-learning'
import { getSupabaseAdmin }              from '@/lib/supabase/admin'

// ── Daily recalibration function ──────────────────────────────────────────────

export const selfLearningRecalibrate = inngest.createFunction(
  {
    id:   'self-learning-recalibrate',
    name: 'Daily Signal Weight Recalibration',
    // Retry once on failure; the job is idempotent
    retries: 1,
  },
  // Run every day at 03:00 UTC (low traffic window)
  { cron: '0 3 * * *' },
  async ({ logger, step }) => {
    const start = Date.now()

    // ── Step 1: Recalculate image signal weights ───────────────────────────────
    const imageResult = await step.run('recalibrate-image-weights', async () => {
      return recalculateSignalWeights('image')
    })

    logger.info('[self-learning] Image weights recalculated:', imageResult)

    // ── Step 2: Recalculate text signal weights ────────────────────────────────
    const textResult = await step.run('recalibrate-text-weights', async () => {
      return recalculateSignalWeights('text')
    })

    logger.info('[self-learning] Text weights recalculated:', textResult)

    // ── Step 3: Log calibration run to Supabase for admin visibility ──────────
    await step.run('log-calibration-run', async () => {
      const supabase = getSupabaseAdmin()
      await supabase.from('calibration_runs').insert({
        ran_at:          new Date().toISOString(),
        duration_ms:     Date.now() - start,
        image_signals:   imageResult.signals,
        text_signals:    textResult.signals,
        image_updated:   imageResult.updated,
        text_updated:    textResult.updated,
      }).catch(err => logger.warn('[self-learning] Failed to log calibration run:', err))
      return { logged: true }
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
    id:   'self-learning-manual-trigger',
    name: 'Manual Signal Weight Recalibration',
    retries: 0,
  },
  { event: 'aiscern/self-learning.recalibrate' },
  async ({ event, logger }) => {
    const modality = event.data?.modality as 'image' | 'text' | 'both' | undefined ?? 'both'
    const results: Record<string, unknown> = {}

    if (modality === 'image' || modality === 'both') {
      results.image = await recalculateSignalWeights('image')
      logger.info('[self-learning] Manual image recalibration:', results.image)
    }

    if (modality === 'text' || modality === 'both') {
      results.text = await recalculateSignalWeights('text')
      logger.info('[self-learning] Manual text recalibration:', results.text)
    }

    return { success: true, results, triggered_by: event.data?.triggered_by ?? 'admin' }
  },
)
