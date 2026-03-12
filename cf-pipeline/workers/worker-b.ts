/**
 * DETECTAI Pipeline — Worker B
 * Shards: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]  |  Cron: every 1 min  |  ~2,000 items/run
 */
import { runScraper, getStatus, Env } from '../src/core'

const MY_SHARDS   = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const ITEMS_SHARD = 200
let shardCursor   = 0

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/status') return Response.json(await getStatus(env))
    if (url.pathname === '/trigger/scrape' && request.method === 'POST') {
      const results = []
      for (let i = 0; i < 4; i++) {
        const shard = MY_SHARDS[shardCursor % MY_SHARDS.length]
        results.push(await runScraper(env, shard, ITEMS_SHARD))
        shardCursor++
      }
      return Response.json({ ok: true, worker: 'B', results })
    }
    return Response.json({ worker: 'B', shards: MY_SHARDS, cron: '*/1 * * * *' })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const start = shardCursor % MY_SHARDS.length
    const end   = start + 4
    const batch = end <= MY_SHARDS.length
      ? MY_SHARDS.slice(start, end)
      : [...MY_SHARDS.slice(start), ...MY_SHARDS.slice(0, end - MY_SHARDS.length)]
    let total = 0
    for (const shard of batch) {
      const r = await runScraper(env, shard, ITEMS_SHARD)
      total += r.inserted
      console.log(`[B] shard=${shard} inserted=${r.inserted} errors=${r.errors}`)
    }
    shardCursor = (shardCursor + 4) % MY_SHARDS.length
    console.log(`[B] Done total=${total}`)
  }
}
