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
  { id: 'scan-completed', name: 'Update user stats on scan complete',
    triggers: [{ event: 'scan/completed' }],
  },
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
  })

// ── 2. Incorrect feedback → queue augmentation sample ────────────────────────
export const onScanFeedback = inngest.createFunction(
  {
    id:          'scan-feedback',
    name:        'Queue augmentation sample on incorrect feedback',
    retries:     3,
    concurrency: { limit: 5 },
    triggers: [{ event: 'scan/feedback' }],
  },
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
  })

// ── 3. Scheduled pipeline health check ───────────────────────────────────────
export const scheduledPipelineCheck = inngest.createFunction(
  { id: 'pipeline-health-check', name: 'Daily pipeline health check',
    triggers: [{ cron: '0 6 * * *' }],
  },
  // 6AM UTC daily
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
  })


// ── D.1 — Process feedback and log to training_feedback table ─────────────────
export const processFeedbackJob = inngest.createFunction(
  {
    id:          'process-feedback-job',
    name:        'Log scan feedback to training_feedback table',
    retries:     2,
    concurrency: { limit: 3 },
    triggers: [{ event: 'scan/feedback' }],
  },
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
  })

// ── 5. Keep HuggingFace models warm (every 10 min) ───────────────────────────
// HF Inference API cold-starts take 20-45s — this prevents that by pinging
// every 10 min. Models stay warm for ~15 min after last request.
// Covers ALL models used in image + text + audio detection pipelines.
export const hfModelWarmup = inngest.createFunction(
  {
    id: 'hf-model-warmup',
    name: 'Keep HuggingFace models warm',
    triggers: [{ cron: '*/10 * * * *' }],  // every 10 min (was 14 — too slow)
    concurrency: { limit: 1 },              // never overlap runs
  },
  async ({ step }) => {
    const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN
    if (!HF_TOKEN) return { skipped: true, reason: 'No HF token' }

    const HF_API = 'https://api-inference.huggingface.co/models'
    const WARM_TEXT = 'The quick brown fox jumps over the lazy dog. This sentence is written by a human.'

    // ── Text models (6 total) ─────────────────────────────────────────────────
    const textResults = await step.run('warm-text-models', async () => {
      const TEXT_MODELS = [
        'saghi776/aiscern-text-detector',           // fine-tuned DeBERTa (primary)
        'openai-community/roberta-base-openai-detector',
        'Hello-SimpleAI/chatgpt-detector-roberta',
        'andreas122001/roberta-mixed-detector',
        'valurank/distilroberta-ai-text-detection',
        'TrustSafeAI/roberta-base-ai-detector',
      ]
      const pings = await Promise.allSettled(TEXT_MODELS.map(model =>
        fetch(`${HF_API}/${model}`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ inputs: WARM_TEXT }),
          signal:  AbortSignal.timeout(12_000),
        }).then(r => ({ model: model.split('/').pop(), status: r.status, warm: r.status !== 503 }))
          .catch(e => ({ model: model.split('/').pop(), error: (e as Error).message, warm: false }))
      ))
      return pings.map(p => p.status === 'fulfilled' ? p.value : { warm: false })
    })

    // ── Image models (6 total) — send a tiny 1x1 white JPEG ──────────────────
    // HF image models need binary data to warm up, not JSON text.
    // A 1x1 white JPEG is 631 bytes — minimal network cost, enough to wake the model.
    const imageResults = await step.run('warm-image-models', async () => {
      // Minimal valid JPEG (1x1 white pixel) as base64
      const TINY_JPEG_B64 =
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
        'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
        'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
        'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
        'AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA' +
        '/9oADAMBAAIRAxEAPwCwABmX/9k='
      const tinyJpeg = Buffer.from(TINY_JPEG_B64, 'base64')

      const IMAGE_MODELS = [
        'saghi776/aiscern-image-detector',   // fine-tuned ViT-Large (primary)
        'Organika/sdxl-detector',
        'umm-maybe/AI-image-detector',
        'Nahrawy/AIorNot',
        'haywoodsloan/ai-image-detector',
        'dima806/deepfake_vs_real_image_detection',
      ]
      const pings = await Promise.allSettled(IMAGE_MODELS.map(model =>
        fetch(`${HF_API}/${model}`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/octet-stream' },
          body:    tinyJpeg,
          signal:  AbortSignal.timeout(15_000),
        }).then(r => ({ model: model.split('/').pop(), status: r.status, warm: r.status !== 503 }))
          .catch(e => ({ model: model.split('/').pop(), error: (e as Error).message, warm: false }))
      ))
      return pings.map(p => p.status === 'fulfilled' ? p.value : { warm: false })
    })

    // ── Audio model ───────────────────────────────────────────────────────────
    const audioResult = await step.run('warm-audio-model', async () => {
      try {
        const res = await fetch(`${HF_API}/mo-thecreator/Deepfake-audio-detection`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ inputs: WARM_TEXT }),
          signal:  AbortSignal.timeout(10_000),
        })
        return { status: res.status, warm: res.status !== 503 }
      } catch (e) { return { warm: false, error: (e as Error).message } }
    })

    // ── DO Python worker keepalive ────────────────────────────────────────────
    // PYTHON_WORKER_URL is the DigitalOcean worker (was: SIGNAL_WORKER_URL)
    const doWorkerResult = await step.run('ping-do-worker', async () => {
      const workerUrl = process.env.PYTHON_WORKER_URL
      if (!workerUrl) return { skipped: true, reason: 'PYTHON_WORKER_URL not set' }
      try {
        const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(15_000) })
        const body = await res.json().catch(() => ({}))
        return { status: res.status, ok: res.ok, version: (body as any).version }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    })

    const textWarm  = (textResults  as any[]).filter((r: any) => r.warm).length
    const imageWarm = (imageResults as any[]).filter((r: any) => r.warm).length

    return {
      warmed_at:    new Date().toISOString(),
      text_models:  { total: 6, warm: textWarm,  results: textResults  },
      image_models: { total: 6, warm: imageWarm, results: imageResults },
      audio_model:  audioResult,
      do_worker:    doWorkerResult,
    }
  })

// ── 6. Keep Vercel serverless functions warm (every 4 min) ───────────────────
// Vercel cold-starts add 2-5s to first request. Ping every 4 min to prevent.
// Pings both text and image detect endpoints so both stay in memory.
export const vercelWarmup = inngest.createFunction(
  {
    id: 'vercel-warmup',
    name: 'Keep Vercel functions warm',
    triggers: [{ cron: '*/4 * * * *' }],   // every 4 min (was 5)
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const baseUrl       = process.env.NEXT_PUBLIC_SITE_URL || 'https://aiscern.com'
    const internalSecret = process.env.INTERNAL_API_SECRET || ''

    // Health check
    await step.run('ping-health', async () => {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
      return { status: res.status, ok: res.ok }
    })

    // Warm text detect function (loads Brain + signal modules into memory)
    await step.run('warm-text-detect', async () => {
      const res = await fetch(`${baseUrl}/api/detect/text`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
        body:    JSON.stringify({ text: 'The quick brown fox jumps over the lazy dog. This is a warmup ping to keep the Vercel serverless function loaded in memory.' }),
        signal:  AbortSignal.timeout(20_000),
      })
      return { status: res.status }
    })

    // Warm upload presign function (keeps R2 client initialised)
    await step.run('warm-warmup-endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/warmup`, { signal: AbortSignal.timeout(5000) })
      return { status: res.status }
    })

    return { warmed_at: new Date().toISOString() }
  })

// ── 7. Supabase keep-alive (every 3 days) ────────────────────────────────────
export const supabaseKeepAlive = inngest.createFunction(
  { id: 'supabase-keep-alive', name: 'Prevent Supabase free-tier pause',
    triggers: [{ cron: '0 12 */3 * *' }],
  },
  async ({ step }) => {
    await step.run('query-profiles', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true })
      return { profile_count: count }
    })
    return { kept_alive_at: new Date().toISOString() }
  })

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
