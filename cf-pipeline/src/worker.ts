/**
 * DETECTAI Pipeline v6 — Universal Worker
 * WORKER_NUM (1–19): scraper | WORKER_NUM 20: HF push + cleanup
 *
 * New in v6:
 *  - Kill switch: PIPELINE_ENABLED=false halts all workers
 *  - HF pushes to data/{media_type}/{language}/part-NNNN.jsonl (proper sharding)
 *  - README auto-updated every 100 ticks (Worker 20)
 *  - Structured JSON logging for every event
 */

import {
  Env, ALL_SOURCES, getWorkerSources,
  scrapeSource, pushToHF, pushReadme, cleanupPushed, getStatus,
} from './core'

import { log } from './types'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url  = new URL(req.url)
    const wnum = parseInt(env.WORKER_NUM ?? '1')
    const wid  = `worker-${wnum}`
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    const repo = env.HF_REPO ?? 'saghi776/detectai-dataset'

    if (url.pathname === '/status') {
      return Response.json(await getStatus(env.DB), { headers: cors })
    }

    if (url.pathname === '/health') {
      const sources = wnum <= 4 ? getWorkerSources(wnum) : []
      return Response.json({
        ok:      true,
        version: 'v6.0',
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
      const result = await pushToHF(env.DB, env.HF_TOKEN, repo, 3000)
      return Response.json({ ok: true, worker: wid, push: result }, { headers: cors })
    }

    if (url.pathname === '/trigger/cleanup' && req.method === 'POST') {
      const deleted = await cleanupPushed(env.DB)
      return Response.json({ ok: true, worker: wid, deleted }, { headers: cors })
    }

    const sources = wnum <= 4 ? getWorkerSources(wnum) : []
    return Response.json({
      worker:  wid,
      version: 'v6.0',
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
    const repo = env.HF_REPO ?? 'saghi776/detectai-dataset'
    const tick = Math.floor(Date.now() / 60_000)

    if (wnum === 20) {
      // Every 360 ticks (6 hours): run calibration workers
      // Workers are HTTP-only (no cron) so we trigger them from here
      if (tick % 360 === 0) {
        const calBase = 'https://detectai-cal-ai.saghirahmed9067.workers.dev'
        const realBase = 'https://detectai-cal-real.saghirahmed9067.workers.dev'
        const aggBase  = 'https://detectai-cal-agg.saghirahmed9067.workers.dev'
        try {
          // Step 1: collect AI + real samples in parallel
          const [aiRes, realRes] = await Promise.all([
            fetch(`${calBase}/run`,  { method: 'POST', signal: AbortSignal.timeout(120_000) }),
            fetch(`${realBase}/run`, { method: 'POST', signal: AbortSignal.timeout(120_000) }),
          ])
          const aiData   = await aiRes.json()   as { inserted?: number; failed?: number }
          const realData = await realRes.json() as { inserted?: number; failed?: number }
          console.log(`[W20] cal-ai: ${aiData.inserted ?? 0} inserted, ${aiData.failed ?? 0} failed`)
          console.log(`[W20] cal-real: ${realData.inserted ?? 0} inserted, ${realData.failed ?? 0} failed`)
          // Step 2: aggregate into calibration_state
          const aggRes  = await fetch(`${aggBase}/run`, { method: 'POST', signal: AbortSignal.timeout(30_000) })
          const aggData = await aggRes.json() as { ai_samples?: number; real_samples?: number }
          console.log(`[W20] cal-agg: AI=${aggData.ai_samples ?? 0} Real=${aggData.real_samples ?? 0}`)
        } catch (calErr: any) {
          console.error('[W20] calibration run failed:', calErr?.message)
        }
      }

      // Every 10 ticks: push to HF with modality+language sharding
      if (tick % 10 === 0) {
        const push = await pushToHF(env.DB, env.HF_TOKEN, repo, 3000)
        if (push.pushed > 0) {
          console.log(`[W20] pushed ${push.pushed} → commit ${push.commitId} | files: ${push.files?.join(', ')}`)
        } else if (push.error) {
          console.error(`[W20] push ERROR: ${push.error}`)
        } else {
          console.log('[W20] nothing pending to push')
        }
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

    // Workers 1–19: rotate through assigned sources each tick
    const sources = getWorkerSources(wnum)
    if (!sources.length) return

    const src = sources[tick % sources.length]
    const res = await scrapeSource(env.DB, src, env.HF_TOKEN, wid, 60)
    console.log(`[W${wnum}] ${res.source} → inserted=${res.inserted} skipped=${res.skipped}${res.error ? ' ERR=' + res.error : ''}`)
  },
}
