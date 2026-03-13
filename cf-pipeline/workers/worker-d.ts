/**
 * DETECTAI Neural Pipeline v4 — Worker D
 * Video deepfake + real video (VIDEO_SOURCES)
 * Captures: duration, resolution, URL, manipulation_type, has_face
 */
import { Env, VIDEO_SOURCES, scrapeSource, getStatus } from '../src/core'

const WORKER_ID  = 'worker-d'
const MY_SOURCES = VIDEO_SOURCES
const BATCH_SIZE = 40   // video metadata is heavier

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url  = new URL(req.url)
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (url.pathname === '/status') return Response.json(await getStatus(env.DB), { headers: cors })
    if (url.pathname === '/health') return Response.json({ ok: true, worker: WORKER_ID }, { headers: cors })

    if (url.pathname === '/trigger/scrape' && req.method === 'POST') {
      const results = []
      for (const src of MY_SOURCES) {
        results.push(await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE))
      }
      return Response.json({ ok: true, worker: WORKER_ID, results }, { headers: cors })
    }

    return Response.json({
      worker:   WORKER_ID,
      modality: 'video',
      sources:  MY_SOURCES.map(s => `${s.name} [${s.label}]`),
      features: ['duration_seconds', 'resolution_w', 'resolution_h', 'has_face', 'manipulation_type', 'content_url'],
    }, { headers: cors })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const tick = Math.floor(Date.now() / 60000)
    const src  = MY_SOURCES[tick % MY_SOURCES.length]
    const res  = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
    console.log(`[D] source=${res.source} inserted=${res.inserted} skipped=${res.skipped}${res.error ? ' err='+res.error : ''}`)
  },
}
