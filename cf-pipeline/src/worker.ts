/**
 * Aiscern Pipeline v8.1 — Universal Worker
 * WORKER_NUM (1–14): scraper only | WORKER_NUM 20: HF push + cleanup (only pusher)
 *
 * BUG-FIX #2: Removed backup push from W1–W14.
 *   OLD: Each scraper worker called pushToHF on tick%5===wnum%5, causing 3 workers
 *        to push simultaneously (e.g. W1, W6, W11 all hit tick%5===1).
 *   FIX: W1–W14 ONLY scrape. W20 is the sole pusher.
 *        push.ts also has a D1 push lock as a second safety net.
 *
 * 15 deployed workers total:
 *   W1–W14  (wrangler-b through wrangler-o): scrape HF datasets into D1
 *   W20     (wrangler-e.toml):               push D1 rows to HuggingFace + cleanup
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
        version: 'v8.1',
        worker:  wid,
        role:    wnum === 20 ? 'hf-push + cleanup (exclusive)' : 'scraper-only',
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
      // Only W20 should call this in production, but allow manual trigger from any worker
      const result = await pushToHF(env.DB, env.HF_TOKEN, env, 5000, wid)
      return Response.json({ ok: true, worker: wid, push: result }, { headers: cors })
    }

    if (url.pathname === '/trigger/cleanup' && req.method === 'POST') {
      const deleted = await cleanupPushed(env.DB)
      return Response.json({ ok: true, worker: wid, deleted }, { headers: cors })
    }

    const sources = wnum <= 14 ? getWorkerSources(wnum) : []
    return Response.json({
      worker:  wid,
      version: 'v8.1',
      role:    wnum === 20 ? 'hf-push + cleanup (exclusive)' : 'scraper-only',
      hf_structure: 'data/{media_type}/{language}/part-NNNN.jsonl',
      sources: sources.map(s => `${s.name} [${s.media_type}]`),
      all_sources_total: ALL_SOURCES.length,
    }, { headers: cors })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (env.PIPELINE_ENABLED === 'false') {
      const wid = `worker-${env.WORKER_NUM ?? '1'}`
      log({ event: 'KILL_SWITCH', worker_id: wid, timestamp: new Date().toISOString() })
      return
    }

    const wnum = parseInt(env.WORKER_NUM ?? '1')
    const wid  = `worker-${wnum}`
    const tick = Math.floor(Date.now() / 60_000)

    // ── W20: push + cleanup ONLY ──────────────────────────────────────────
    if (wnum === 20) {
      const push = await pushToHF(env.DB, env.HF_TOKEN, env, 5000, wid)
      if (push.pushed > 0) {
        console.log(`[W20] pushed ${push.pushed} → commit ${push.commitId} | files: ${push.files?.join(', ')}`)
      } else if ((push as any).skipped === 'push_locked') {
        console.log('[W20] push skipped — another worker holds the lock (should not happen)')
      } else if (push.error) {
        console.error(`[W20] push ERROR: ${push.error}`)
      } else {
        console.log('[W20] nothing pending to push')
      }

      // Every 50 ticks (~50 min): update README
      if (tick % 50 === 0) {
        await pushReadme(env.DB, env.HF_TOKEN, env)
        console.log('[W20] README updated')
      }

      // Every 100 ticks (~100 min): cleanup orphaned rows
      if (tick % 100 === 0) {
        const deleted = await cleanupPushed(env.DB)
        if (deleted > 0) console.log(`[W20] cleanup: removed ${deleted} orphaned records`)
      }
      return
    }

    // ── W1–W14: scrape ONLY — BUG-FIX #2: no backup push ─────────────────
    const sources = getWorkerSources(wnum)
    if (!sources.length) return

    const results  = await scrapeParallel(env.DB, sources, env.HF_TOKEN, wid, wnum)
    const totalIns = results.reduce((s, r) => s + r.inserted, 0)
    const errors   = results.filter(r => r.error).map(r => `${r.source}: ${r.error}`).join('; ')

    console.log(`[W${wnum}] tick=${tick} sources=${results.length} inserted=${totalIns}${errors ? ` ERRORS: ${errors}` : ''}`)
    // NOTE: No pushToHF call here — W20 is the sole pusher (Bug #2 fix)
  },
}
