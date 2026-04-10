/**
 * Aiscern Pipeline v7.3 — Universal Worker
 * WORKER_NUM (1–14): scraper | WORKER_NUM 20: HF push + cleanup
 *
 * 15 deployed workers total:
 *   W1–W14  (wrangler.toml, -b through -o): scrape HF datasets into D1
 *   W20     (wrangler-e.toml):              push D1 rows to HuggingFace + cleanup
 *
 * Source distribution (70 sources ÷ 14 workers = 5 each):
 *   W01–W06: text  (30 sources)   W07–W09: image (15 sources)
 *   W10–W12: audio (15 sources)   W13–W14: video  (8 sources + 2 audio)
 */
import {
  Env, ALL_SOURCES, getWorkerSources,
  scrapeSource, scrapeParallel, pushToHF, pushReadme, cleanupPushed, getStatus,
} from './core'

import { log } from './types'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url  = new URL(req.url)
    const wnum = parseInt(env.WORKER_NUM ?? '1')
    const wid  = `worker-${wnum}`
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (url.pathname === '/status') {
      return Response.json(await getStatus(env.DB), { headers: cors })
    }

    if (url.pathname === '/health') {
      const sources = wnum <= 14 ? getWorkerSources(wnum) : []
      return Response.json({
        ok:      true,
        version: 'v7.1',
        worker:  wid,
        role:    wnum === 20 ? 'hf-push + cleanup' : 'scraper',
        pipeline_enabled: env.PIPELINE_ENABLED !== 'false',
        sources: sources.map(s => `${s.name} [${s.media_type}/${s.label}]`),
        ts:      new Date().toISOString(),
      }, { headers: cors })
    }

    if (url.pathname === '/trigger/scrape' && req.method === 'POST') {
      if (env.PIPELINE_ENABLED === 'false') return Response.json({ error: 'kill switch active' }, { status: 503, headers: cors })
      if (wnum === 20) return Response.json({ error: 'worker 20 is push-only' }, { status: 400, headers: cors })
      const sources = getWorkerSources(wnum)
      const src     = sources[Math.floor(Math.random() * sources.length)]
      const result  = await scrapeSource(env.DB, src, env.HF_TOKEN, wid, 60)
      return Response.json({ ok: true, worker: wid, result }, { headers: cors })
    }

    if (url.pathname === '/trigger/push' && req.method === 'POST') {
      const result = await pushToHF(env.DB, env.HF_TOKEN, env, 5000)
      return Response.json({ ok: true, worker: wid, push: result }, { headers: cors })
    }

    if (url.pathname === '/trigger/cleanup' && req.method === 'POST') {
      const deleted = await cleanupPushed(env.DB)
      return Response.json({ ok: true, worker: wid, deleted }, { headers: cors })
    }

    const sources = wnum <= 14 ? getWorkerSources(wnum) : []
    return Response.json({
      worker:  wid,
      version: 'v7.1',
      role:    wnum === 20 ? 'hf-push + cleanup' : 'scraper',
      hf_structure: 'data/{media_type}/{language}/part-NNNN.jsonl',
      sources: sources.map(s => `${s.name} [${s.media_type}]`),
      all_sources_total: ALL_SOURCES.length,
    }, { headers: cors })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // ── Global kill switch ─────────────────────────────────────────────────
    if (env.PIPELINE_ENABLED === 'false') {
      const wid = `worker-${env.WORKER_NUM ?? '1'}`
      log({ event: 'KILL_SWITCH', worker_id: wid, timestamp: new Date().toISOString() })
      return
    }

    const wnum = parseInt(env.WORKER_NUM ?? '1')
    const wid  = `worker-${wnum}`
    const tick = Math.floor(Date.now() / 60_000)

    if (wnum === 20) {
      // Every tick: push all pending items to HF (cron runs every minute)
      const push = await pushToHF(env.DB, env.HF_TOKEN, env, 5000)
        if (push.pushed > 0) {
          console.log(`[W20] pushed ${push.pushed} → commit ${push.commitId} | files: ${push.files?.join(', ')}`)
        } else if (push.error) {
          console.error(`[W20] push ERROR: ${push.error}`)
        } else {
          console.log('[W20] nothing pending to push')
        }
      // Every 50 ticks: update README with fresh stats
      if (tick % 50 === 0) {
        await pushReadme(env.DB, env.HF_TOKEN, repo)
        console.log('[W20] README updated')
      }
      // Every 100 ticks: cleanup orphaned rows
      if (tick % 100 === 0) {
        const deleted = await cleanupPushed(env.DB)
        if (deleted > 0) console.log(`[W20] cleanup: removed ${deleted} orphaned records`)
      }
      return
    }

    // Workers 1–19: rotate through assigned sources + backup push every 5 ticks
    const sources = getWorkerSources(wnum)
    if (!sources.length) return

    // Scrape: use scrapeParallel for 3 sources per tick (v7 speed upgrade)
    const results = await scrapeParallel(env.DB, sources, env.HF_TOKEN, wid, 3)
    const totalIns = results.reduce((s, r) => s + r.inserted, 0)
    console.log(`[W${wnum}] scraped=${results.length} inserted=${totalIns}`)

    // Backup push: each worker pushes on a different tick offset to avoid D1 collisions
    // W1 pushes on tick%5===0, W2 on tick%5===1, etc.
    if (tick % 5 === (wnum % 5)) {
      const push = await pushToHF(env.DB, env.HF_TOKEN, env, 5000)
      if (push.pushed > 0) {
        console.log(`[W${wnum}] push: ${push.pushed} → ${push.commitId}`)
      } else if (push.error) {
        console.error(`[W${wnum}] push ERR: ${push.error}`)
      }
    }
  },
}
