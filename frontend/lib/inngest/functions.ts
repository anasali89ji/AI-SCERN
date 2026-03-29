/**
 * Aiscern — Inngest Function Definitions
 *
 * All background jobs run here. Inngest handles retries, concurrency,
 * and scheduling. Functions are exported from this file and registered
 * in app/api/inngest/route.ts.
 */

import { inngest } from './client'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// ── 1. Scan completed → update user stats ────────────────────────────────────
export const onScanCompleted = inngest.createFunction(
  { id: 'scan-completed', name: 'Update user stats on scan complete' },
  { event: 'scan/completed' },
  async ({ event, step }) => {
    const { user_id, media_type, verdict, confidence } = event.data

    await step.run('update-scan-stats', async () => {
      if (!user_id || user_id.startsWith('anon_') || user_id === 'internal') return

      const sb = getSupabaseAdmin()

      // Increment scan_count and monthly_scans on the profile
      try {
        await sb.rpc('increment_scan_count', {
          p_user_id:    user_id,
          p_media_type: media_type,
        })
      } catch { /* non-fatal — RPC may not exist yet */ }

      return { user_id, verdict, confidence }
    })
  }
)

// ── 2. Incorrect feedback → queue augmentation sample ────────────────────────
export const onScanFeedback = inngest.createFunction(
  {
    id:          'scan-feedback',
    name:        'Queue augmentation sample on incorrect feedback',
    retries:     3,
    concurrency: { limit: 5 },
  },
  { event: 'scan/feedback' },
  async ({ event, step }) => {
    const { scan_id, feedback, verdict } = event.data

    if (feedback !== 'incorrect') return { skipped: true }

    const scan = await step.run('fetch-scan', async () => {
      const sb = getSupabaseAdmin()
      const { data } = await sb
        .from('scans')
        .select('*')
        .eq('id', scan_id)
        .single()
      return data
    })

    if (!scan) return { error: 'Scan not found' }

    await step.run('queue-augment-job', async () => {
      const sb = getSupabaseAdmin()
      try {
        await sb.from('pipeline_jobs').insert({
          job_type: 'augment',
          priority: 5,
          payload: {
            scan_id:    scan.id,
            media_type: scan.media_type,
            verdict,
            confidence: scan.confidence_score,
            feedback:   'incorrect',
            r2_key:     scan.r2_key ?? null,
          },
        })
      } catch { /* non-fatal */ }
    })

    return { queued: true, scan_id }
  }
)

// ── 3. Scheduled pipeline health check ───────────────────────────────────────
export const scheduledPipelineCheck = inngest.createFunction(
  { id: 'pipeline-health-check', name: 'Daily pipeline health check' },
  { cron: '0 6 * * *' }, // 6AM UTC daily
  async ({ step }) => {
    const stats = await step.run('check-d1-stats', async () => {
      const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID
      const d1Db      = process.env.CLOUDFLARE_D1_DATABASE_ID
      const cfToken   = process.env.CLOUDFLARE_API_TOKEN

      if (!cfAccount || !d1Db || !cfToken) return { error: 'Cloudflare not configured' }

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/d1/database/${d1Db}/query`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfToken}` },
          body:    JSON.stringify({ sql: 'SELECT total_scraped, total_pushed FROM pipeline_state WHERE id=1' }),
          signal:  AbortSignal.timeout(10000),
        }
      ).then(r => r.json()).catch(() => null)

      return res?.result?.[0]?.results?.[0] ?? { error: 'Query failed' }
    })

    return { checked_at: new Date().toISOString(), stats }
  }
)

// ── All functions export (registered in the serve route) ─────────────────────
export const INNGEST_FUNCTIONS = [
  onScanCompleted,
  onScanFeedback,
  scheduledPipelineCheck,
]
