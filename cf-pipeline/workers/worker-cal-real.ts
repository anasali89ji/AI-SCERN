/**
 * DETECTAI — Calibration Worker: Real Images
 * Fetches 200 real photos (Unsplash + Flickr) and computes pixel signals.
 * HTTP-only worker — triggered by Worker E every 6 hours.
 */

import { signalsFromHFDataset } from '../src/calibration/signals-web'

interface Env {
  DB:       D1Database
  HF_TOKEN: string
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

const REAL_SOURCES = [
  // Unsplash — 120 samples
  ...Array.from({ length: 120 }, (_, i) => ({
    dataset:  'jamescalam/unsplash-25k-photos',
    config:   'default',
    split:    'train',
    offset:   Math.floor(Math.random() * 20_000) + i * 180,
    urlField: 'photo_image_url',
    name: 'unsplash',
  })),
  // Flickr30k — 50 samples
  ...Array.from({ length: 50 }, (_, i) => ({
    dataset:    'nlphuji/flickr30k',
    config:     'default',
    split:      'test',
    offset:     Math.floor(Math.random() * 25_000) + i * 500,
    imageField: 'image',
    name: 'flickr',
  })),
  // DIV2K real photos — 30 samples (high-quality real photography)
  ...Array.from({ length: 30 }, (_, i) => ({
    dataset:    'eugenesiow/Div2k',
    config:     'bicubic_x2',
    split:      'train',
    offset:     Math.floor(Math.random() * 700) + i * 25,
    imageField: 'hr',
    name: 'div2k',
  })),
]

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/health') {
      return Response.json({ ok: true, role: 'cal-real', sources: 200 }, { headers: CORS })
    }

    if (url.pathname === '/run' && req.method === 'POST') {
      return runCalibration(env)
    }

    if (url.pathname === '/status') {
      const count = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM calibration_samples WHERE label='real'`
      ).first<{n:number}>()
      return Response.json({ ok: true, real_samples_pending: count?.n ?? 0 }, { headers: CORS })
    }

    return Response.json({ worker: 'cal-real', status: 'ready', sources_to_sample: 200 }, { headers: CORS })
  },
}

async function runCalibration(env: Env): Promise<Response> {
  const start   = Date.now()
  let inserted  = 0
  let failed    = 0
  const batchSize = 10

  await env.DB.prepare(`DELETE FROM calibration_samples WHERE label='real'`).run().catch(() => {})

  for (let i = 0; i < REAL_SOURCES.length; i += batchSize) {
    const batch   = REAL_SOURCES.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(src => signalsFromHFDataset(
        src.dataset, src.config, src.split, src.offset,
        env.HF_TOKEN,
        (src as any).imageField,
        (src as any).urlField,
      ))
    )

    const stmts = []
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled' && r.value) {
        const sig = r.value
        stmts.push(env.DB.prepare(`
          INSERT INTO calibration_samples
            (id, label, source, entropy, noise, luminance, background, color_balance, compression, created_at)
          VALUES (?, 'real', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          batch[j].name,
          sig.entropy, sig.noise, sig.luminance,
          sig.background, sig.colorBalance, sig.compression,
        ))
        inserted++
      } else {
        failed++
      }
    }
    if (stmts.length > 0) await env.DB.batch(stmts).catch(() => {})
  }

  return Response.json({
    ok: true, inserted, failed,
    duration_ms: Date.now() - start,
  }, { headers: CORS })
}
