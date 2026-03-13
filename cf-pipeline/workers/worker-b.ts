/**
 * DETECTAI Neural Pipeline v4 — Worker B
 * Image deepfake + real samples (IMAGE_SOURCES)
 */
import { Env, IMAGE_SOURCES, scrapeSource, getStatus } from '../src/core'

const WORKER_ID  = 'worker-b'
const MY_SOURCES = IMAGE_SOURCES
const BATCH_SIZE = 50   // images heavier to process

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url  = new URL(req.url)
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (url.pathname === '/status') return Response.json(await getStatus(env.DB), { headers: cors })
    if (url.pathname === '/health') return Response.json({ ok: true, worker: WORKER_ID }, { headers: cors })

    if (url.pathname === '/trigger/scrape' && req.method === 'POST') {
      const src = MY_SOURCES[Math.floor(Math.random() * MY_SOURCES.length)]
      const r   = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
      return Response.json({ ok: true, worker: WORKER_ID, result: r }, { headers: cors })
    }

    return Response.json({ worker: WORKER_ID, modality: 'image', sources: MY_SOURCES.map(s => s.name) }, { headers: cors })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const idx = Math.floor(Date.now() / 60000) % MY_SOURCES.length
    const src = MY_SOURCES[idx]
    const res = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
    console.log(`[B] source=${res.source} inserted=${res.inserted} skipped=${res.skipped}${res.error ? ' err='+res.error : ''}`)
  },
}
