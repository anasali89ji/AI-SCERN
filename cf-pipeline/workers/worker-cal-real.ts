/**
 * DETECTAI — Calibration Worker: Real Photos
 *
 * Fetches 30 real photos from Unsplash and computes pixel signals.
 * Reduced from 200 → 30 to stay within CF Workers 30s CPU time limit.
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
        `SELECT COUNT(*) as n FROM calibration_samples WHERE label='real'`
      ).first<{n:number}>().catch(() => ({n:0}))
      return Response.json({ ok: true, role: 'cal-real', pending_samples: count?.n ?? 0 }, { headers: CORS })
    }

    if (url.pathname === '/run' && req.method === 'POST') {
      return runCalibration(env)
    }

    return Response.json({ worker: 'cal-real', status: 'ready' }, { headers: CORS })
  },
}

async function runCalibration(env: Env): Promise<Response> {
  const start = Date.now()

  await env.DB.prepare(`DELETE FROM calibration_samples WHERE label='real'`).run().catch(() => {})

  // 30 random offsets from Unsplash 25k (real photos)
  const offsets: number[] = []
  for (let i = 0; i < 30; i++) {
    offsets.push(Math.floor(Math.random() * 24_000))
  }

  let inserted = 0
  let failed   = 0

  const batchSize = 5
  for (let i = 0; i < offsets.length; i += batchSize) {
    const batch = offsets.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(offset =>
        signalsFromHFDataset(
          'jamescalam/unsplash-25k-photos',
          'default',
          'train',
          offset,
          env.HF_TOKEN,
          'image',
          'photo_image_url',
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
          VALUES (?, 'real', 'unsplash', ?, ?, ?, ?, ?, ?, datetime('now'))
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

    if (Date.now() - start > 25_000) {
      console.warn(`[cal-real] Time limit approaching — stopping at ${inserted} samples`)
      break
    }
  }

  return Response.json({
    ok: true, inserted, failed,
    duration_ms: Date.now() - start,
  }, { headers: CORS })
}
