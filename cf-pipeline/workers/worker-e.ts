/**
 * DETECTAI Neural Pipeline v4 — Worker E
 * HuggingFace Push + Cleanup Orchestrator
 * Runs every 10 min: pushes pending items → HF dataset, then deletes pushed records after 48h
 * Also fills in remaining TEXT_SOURCES not covered by Worker A
 */
import {
  Env, TEXT_SOURCES, scrapeSource, pushToHF, cleanupPushed, getStatus
} from '../src/core'

const WORKER_ID      = 'worker-e'
const PUSH_BATCH     = 3000    // items per HF push
const SCRAPE_SOURCES = TEXT_SOURCES.filter((_, i) => i % 5 !== 0)   // complement of Worker A
const BATCH_SIZE     = 60

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url  = new URL(req.url)
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (url.pathname === '/status') return Response.json(await getStatus(env.DB), { headers: cors })
    if (url.pathname === '/health') return Response.json({ ok: true, worker: WORKER_ID }, { headers: cors })

    // Manual HF push trigger
    if (url.pathname === '/trigger/push' && req.method === 'POST') {
      const repo   = env.HF_REPO ?? 'saghi776/detectai-dataset'
      const result = await pushToHF(env.DB, env.HF_TOKEN, repo, PUSH_BATCH)
      return Response.json({ ok: true, worker: WORKER_ID, push: result }, { headers: cors })
    }

    // Manual cleanup trigger
    if (url.pathname === '/trigger/cleanup' && req.method === 'POST') {
      const deleted = await cleanupPushed(env.DB)
      return Response.json({ ok: true, worker: WORKER_ID, deleted }, { headers: cors })
    }

    // Manual scrape trigger
    if (url.pathname === '/trigger/scrape' && req.method === 'POST') {
      const src = SCRAPE_SOURCES[Math.floor(Math.random() * SCRAPE_SOURCES.length)]
      const r   = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
      return Response.json({ ok: true, worker: WORKER_ID, result: r }, { headers: cors })
    }

    return Response.json({
      worker:       WORKER_ID,
      role:         'HF Push + Cleanup + Text fill-in',
      push_batch:   PUSH_BATCH,
      cleanup_ttl:  '48h after push',
      scrape_sources: SCRAPE_SOURCES.map(s => s.name),
    }, { headers: cors })
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const repo = env.HF_REPO ?? 'saghi776/detectai-dataset'
    const tick = Math.floor(Date.now() / 60000)

    // Every tick: scrape remaining text sources
    if (SCRAPE_SOURCES.length > 0) {
      const src = SCRAPE_SOURCES[tick % SCRAPE_SOURCES.length]
      const res = await scrapeSource(env.DB, src, env.HF_TOKEN, WORKER_ID, BATCH_SIZE)
      console.log(`[E] scrape source=${res.source} inserted=${res.inserted}${res.error ? ' err='+res.error : ''}`)
    }

    // Every 10th tick (~10 min): push to HuggingFace
    if (tick % 10 === 0) {
      const push = await pushToHF(env.DB, env.HF_TOKEN, repo, PUSH_BATCH)
      if (push.pushed > 0) {
        console.log(`[E] HF push: ${push.pushed} items → commit ${push.commitId}`)
      } else if (push.error) {
        console.error(`[E] HF push FAILED: ${push.error}`)
      } else {
        console.log('[E] HF push: nothing pending')
      }
    }

    // Every 100th tick (~100 min): cleanup old pushed records
    if (tick % 100 === 0) {
      const deleted = await cleanupPushed(env.DB)
      if (deleted > 0) console.log(`[E] cleanup: deleted ${deleted} pushed records`)
    }
  },
}
