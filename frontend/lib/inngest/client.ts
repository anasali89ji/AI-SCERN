/**
 * Aiscern — Inngest Client
 *
 * Inngest handles background jobs triggered after scans:
 *   - scan/completed  → feedback loop, augmentation jobs
 *   - scan/feedback   → mark incorrect, queue retraining sample
 *   - pipeline/push   → trigger HF dataset push after threshold
 *
 * Required env vars (set in Vercel + Inngest dashboard):
 *   INNGEST_EVENT_KEY   — from app.inngest.com → your app → Event Key
 *   INNGEST_SIGNING_KEY — from app.inngest.com → your app → Signing Key
 *
 * In development: npx inngest-cli@latest dev
 * In production:  auto-detected via Vercel integration
 */

import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id:   'aiscern',
  name: 'Aiscern Detection Platform',
})

// ── Event type definitions ────────────────────────────────────────────────────

export type AiscernEvents = {
  'scan/completed': {
    data: {
      scan_id:    string
      user_id:    string
      media_type: 'text' | 'image' | 'audio' | 'video'
      verdict:    'AI' | 'HUMAN' | 'UNCERTAIN'
      confidence: number
      model_used: string
      r2_key?:    string
    }
  }
  'scan/feedback': {
    data: {
      scan_id:  string
      user_id:  string
      feedback: 'correct' | 'incorrect'
      verdict:  string
    }
  }
  'pipeline/push': {
    data: {
      trigger:     'threshold' | 'manual' | 'scheduled'
      item_count?: number
    }
  }
}
