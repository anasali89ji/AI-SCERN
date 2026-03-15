/**
 * DETECTAI — Calibration Worker: AI Images
 *
 * Fetches 30 AI images from DiffusionDB and computes pixel signals.
 * Reduced from 200 → 30 to stay within CF Workers 30s CPU time limit.
 * Worker E triggers this via HTTP every 6 hours.
 */

import { signalsFromHFDataset } from '../src/calibration/signals-web'

interface Env {
  DB:       D1Database
  HF_TOKEN: string
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/health') {
      const count = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM calibration_samples WHERE label='ai'`
      ).first<{n:number}>().catch(() => ({n:0}))
      return Response.json({ ok: true, role: 'cal-ai', pending_samples: count?.n ?? 0 }, { headers: CORS })
    }

    if (url.pathname === '/run' && req.method === 'POST') {
      return runCalibration(env)
    }

    return Response.json({ worker: 'cal-ai', status: 'ready' }, { headers: CORS })
  },
}

async function runCalibration(env: Env): Promise<Response> {
  const start = Date.now()

  // Clear previous AI samples
  await env.DB.prepare(`DELETE FROM calibration_samples WHERE label='ai'`).run().catch(() => {})

  // Sample 30 random offsets from DiffusionDB large_random_100k
  // Keep it small — CF Workers 30s wall clock, HF API ~2-5s per image
  const offsets: number[] = []
  for (let i = 0; i < 30; i++) {
    offsets.push(Math.floor(Math.random() * 95_000))
  }

  let inserted = 0
  let failed   = 0

  // Process in batches of 5 (parallel) — 6 batches × ~5s = ~30s max
  const batchSize = 5
  for (let i = 0; i < offsets.length; i += batchSize) {
    const batch = offsets.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(offset =>
        signalsFromHFDataset(
          'poloclub/diffusiondb',
          'large_random_100k',
          'train',
          offset,
          env.HF_TOKEN,
          'image',
          undefined,
        )
      )
    )

    const stmts = []
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const sig = r.value
        stmts.push(env.DB.prepare(`
          INSERT INTO calibration_samples
            (id, label, source, entropy, noise, luminance, background, color_balance, compression, created_at)
          VALUES (?, 'ai', 'diffusiondb', ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          sig.entropy, sig.noise, sig.luminance,
          sig.background, sig.colorBalance, sig.compression,
        ))
        inserted++
      } else {
        failed++
      }
    }
    if (stmts.length > 0) await env.DB.batch(stmts).catch(() => {})

    // Safety: stop if we've used 25s already (leave 5s buffer)
    if (Date.now() - start > 25_000) {
      console.warn(`[cal-ai] Time limit approaching — stopping at ${inserted} samples`)
      break
    }
  }

  return Response.json({
    ok: true, inserted, failed,
    duration_ms: Date.now() - start,
  }, { headers: CORS })
}
