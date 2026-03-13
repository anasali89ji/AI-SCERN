/**
 * DETECTAI Neural Pipeline v4 — Worker A
 * Text AI + Human samples (shards 0–9 of TEXT_SOURCES)
 * Routes: GET /status, GET /health, POST /trigger/scrape
 */
import { Env, TEXT_SOURCES, scrapeSource, getStatus } from './core'

const WORKER_ID  = 'worker-a'
const MY_SOURCES = TEXT_SOURCES.filter((_, i) => i % 5 === 0)   // every 5th source
const BATCH_SIZE = 60   // items per source per cron tick

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (url.pathname === '/status') {
      const data = await getStatus(env.DB)
      return Response.json(data, { headers: cors })
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, worker: WORKER_ID, ts: new Date().toISOString() }, { headers: cors })
    }

    if (url.pathname === '/trigger/scrape' && req.method === 'POST') {
      const results = []
      const src = MY_SOURCES[Math.floor(Math.random() * MY_SOURCES.length)]
      results.push(await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE))
      return Response.json({ ok: true, worker: WORKER_ID, results }, { headers: cors })
    }

    return Response.json({
      worker:     WORKER_ID,
      modality:   'text',
      sources:    MY_SOURCES.map(s => s.name),
      cron:       '*/1 * * * *',
      batch_size: BATCH_SIZE,
    }, { headers: cors })
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Round-robin across assigned sources each tick
    const idx  = Math.floor(Date.now() / 60000) % MY_SOURCES.length
    const src  = MY_SOURCES[idx]
    const res  = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
    console.log(`[A] source=${res.source} inserted=${res.inserted} skipped=${res.skipped}${res.error ? ' err='+res.error : ''}`)
  },
}
