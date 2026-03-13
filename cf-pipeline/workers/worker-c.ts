/**
 * DETECTAI Neural Pipeline v4 — Worker C
 * Audio deepfake + real speech (AUDIO_SOURCES)
 * Captures: duration, sample_rate, transcript, speaker metadata
 */
import { Env, AUDIO_SOURCES, scrapeSource, getStatus } from '../src/core'

const WORKER_ID  = 'worker-c'
const MY_SOURCES = AUDIO_SOURCES
const BATCH_SIZE = 60

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url  = new URL(req.url)
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (url.pathname === '/status') return Response.json(await getStatus(env.DB), { headers: cors })
    if (url.pathname === '/health') return Response.json({ ok: true, worker: WORKER_ID }, { headers: cors })

    if (url.pathname === '/trigger/scrape' && req.method === 'POST') {
      // Scrape ALL audio sources in one trigger call
      const results = []
      for (const src of MY_SOURCES.slice(0, 3)) {
        results.push(await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE))
      }
      return Response.json({ ok: true, worker: WORKER_ID, results }, { headers: cors })
    }

    return Response.json({
      worker:   WORKER_ID,
      modality: 'audio',
      sources:  MY_SOURCES.map(s => `${s.name} [${s.label}]`),
      features: ['duration_seconds', 'sample_rate', 'transcript', 'speaker_meta', 'has_speech'],
    }, { headers: cors })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Rotate across audio sources
    const tick = Math.floor(Date.now() / 60000)
    const src  = MY_SOURCES[tick % MY_SOURCES.length]
    const res  = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
    console.log(`[C] source=${res.source} inserted=${res.inserted} skipped=${res.skipped}${res.error ? ' err='+res.error : ''}`)
  },
}
