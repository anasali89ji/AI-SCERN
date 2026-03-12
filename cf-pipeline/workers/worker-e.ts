/**
 * DETECTAI Pipeline — Worker E
 * Shards: 40–49  |  Scrape: every 1 min  |  HF Push: every 10 min
 * This worker is also responsible for pushing all pending items to HuggingFace.
 */
import { runScraper, runHFPush, getStatus, Env } from '../src/core'

const MY_SHARDS   = [40,41,42,43,44,45,46,47,48,49]
const ITEMS_SHARD = 200
let shardCursor   = 0

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/status')   return Response.json(await getStatus(env))
    if (url.pathname === '/trigger/scrape' && request.method === 'POST') {
      const results = []
      for (let i = 0; i < 4; i++) {
        const shard = MY_SHARDS[shardCursor % MY_SHARDS.length]
        results.push(await runScraper(env, shard, ITEMS_SHARD))
        shardCursor++
      }
      return Response.json({ ok: true, worker: 'E', results })
    }
    if (url.pathname === '/trigger/hf-push' && request.method === 'POST') {
      const result = await runHFPush(env)
      return Response.json({ ok: true, result })
    }
    return Response.json({
      worker: 'E',
      shards: MY_SHARDS,
      crons: { scrape: '*/1 * * * *', hf_push: '*/10 * * * *' },
      note: 'Worker E also handles all HuggingFace pushes',
    })
  },

  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const cron = event.cron

    // Every minute — scrape
    if (cron === '*/1 * * * *') {
      const start = shardCursor % MY_SHARDS.length
      const end   = start + 4
      const batch = end <= MY_SHARDS.length
        ? MY_SHARDS.slice(start, end)
        : [...MY_SHARDS.slice(start), ...MY_SHARDS.slice(0, end - MY_SHARDS.length)]
      let total = 0
      for (const shard of batch) {
        const r = await runScraper(env, shard, ITEMS_SHARD)
        total += r.inserted
        console.log(`[E] shard=${shard} inserted=${r.inserted} errors=${r.errors}`)
      }
      shardCursor = (shardCursor + 4) % MY_SHARDS.length
      console.log(`[E-scrape] Done total=${total}`)
    }

    // Every 10 minutes — push to HuggingFace
    if (cron === '*/10 * * * *') {
      try {
        const result = await runHFPush(env)
        console.log(`[E-hf-push] pushed=${result.pushed} commitId=${result.commitId}`)
      } catch (err: any) {
        console.error(`[E-hf-push ERROR] ${err?.message}`)
      }
    }
  }
}
