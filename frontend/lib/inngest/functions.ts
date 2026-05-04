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


// ── D.1 — Process feedback and log to training_feedback table ─────────────────
export const processFeedbackJob = inngest.createFunction(
  {
    id:          'process-feedback-job',
    name:        'Log scan feedback to training_feedback table',
    retries:     2,
    concurrency: { limit: 3 },
  },
  { event: 'scan/feedback' },
  async ({ event, step }) => {
    const { scan_id, user_id, feedback, verdict } = event.data

    await step.run('log-feedback-to-training-table', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()

      const { data: scan } = await sb
        .from('scans')
        .select('content_preview, confidence_score, media_type')
        .eq('id', scan_id)
        .single()

      if (!scan) return { skipped: true, reason: 'scan not found' }

      // Infer what the user believes the correct label is
      const userSays = feedback === 'incorrect'
        ? (verdict === 'AI' ? 'HUMAN' : 'AI')
        : verdict

      await sb.from('training_feedback').upsert({
        scan_id,
        text_preview:  scan.content_preview ?? null,
        model_verdict: verdict,
        user_says:     userSays,
        confidence:    scan.confidence_score,
        media_type:    scan.media_type ?? 'text',
        logged_at:     new Date().toISOString(),
      }, { onConflict: 'scan_id' })

      return { logged: true, scan_id, userSays }
    })
  }
)

// ── 5. Keep HuggingFace models warm (every 14 min) ───────────────────────────
export const hfModelWarmup = inngest.createFunction(
  { id: 'hf-model-warmup', name: 'Keep HuggingFace models warm' },
  { cron: '*/14 * * * *' },
  async ({ step }) => {
    const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN
    if (!HF_TOKEN) return { skipped: true, reason: 'No HF token' }

    const models = [
      'openai-community/roberta-base-openai-detector',
      'Hello-SimpleAI/chatgpt-detector-roberta',
      'umm-maybe/AI-image-detector',
      'Organika/sdxl-detector',
      'mo-thecreator/Deepfake-audio-detection',
    ]

    const warmText = 'This is an automated warmup ping to keep the model warm for users.'

    const results = await step.run('ping-hf-models', async () => {
      const pings = await Promise.allSettled(models.map(model =>
        fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: warmText }),
          signal: AbortSignal.timeout(8000),
        }).then(r => ({ model, status: r.status })).catch(e => ({ model, error: (e as Error).message }))
      ))
      return pings.map(p => p.status === 'fulfilled' ? p.value : { error: 'failed' })
    })

    // ── Signal Worker keepalive (HuggingFace Space) ───────────────────────────
    // Ping every 14 min to prevent cold starts on the Python forensic worker.
    const signalWorkerResult = await step.run('ping-signal-worker', async () => {
      const workerUrl = process.env.SIGNAL_WORKER_URL
      if (!workerUrl) return { skipped: true, reason: 'SIGNAL_WORKER_URL not set' }
      try {
        const res = await fetch(`${workerUrl}/health`, {
          signal: AbortSignal.timeout(30_000),
        })
        const body = await res.json().catch(() => ({}))
        return { status: res.status, ok: res.ok, body }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    })

    return { warmed_at: new Date().toISOString(), results, signal_worker: signalWorkerResult }
  }
)

// ── 6. Self-ping to prevent Vercel cold starts (every 5 min) ─────────────────
export const vercelWarmup = inngest.createFunction(
  { id: 'vercel-warmup', name: 'Keep Vercel functions warm' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aiscern.com'

    await step.run('ping-health', async () => {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
      return { status: res.status, ok: res.ok }
    })

    await step.run('warm-text-endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/detect/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
        },
        body: JSON.stringify({ text: 'This is an automated warmup request to prevent cold starts on the Vercel serverless function for Aiscern AI detection platform.' }),
        signal: AbortSignal.timeout(10000),
      })
      return { status: res.status }
    })

    return { warmed_at: new Date().toISOString() }
  }
)

// ── 7. Supabase keep-alive (every 3 days) ────────────────────────────────────
export const supabaseKeepAlive = inngest.createFunction(
  { id: 'supabase-keep-alive', name: 'Prevent Supabase free-tier pause' },
  { cron: '0 12 */3 * *' },
  async ({ step }) => {
    await step.run('query-profiles', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true })
      return { profile_count: count }
    })
    return { kept_alive_at: new Date().toISOString() }
  }
)

// ── Forensic cascade (v2) ─────────────────────────────────────────────────────
import { imageForensicCascade } from './forensic-cascade'
export { imageForensicCascade }

// ── All functions export (registered in the serve route) ─────────────────────
export const INNGEST_FUNCTIONS = [
  onScanCompleted,
  onScanFeedback,
  scheduledPipelineCheck,
  processFeedbackJob,
  hfModelWarmup,
  vercelWarmup,
  supabaseKeepAlive,
  imageForensicCascade,
]
