/**
 * DETECTAI — Calibration Worker: AI Images
 * Fetches 200 AI images (DiffusionDB + other sources) and computes pixel signals.
 * HTTP-only worker — triggered by Worker E every 6 hours.
 * Shares D1 database with pipeline workers.
 */

import { signalsFromHFDataset } from '../src/calibration/signals-web'

interface Env {
  DB:        D1Database
  HF_TOKEN:  string
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

// AI image sources to sample from
const AI_SOURCES = [
  // DiffusionDB — primary source (Stable Diffusion)
  ...Array.from({ length: 120 }, (_, i) => ({
    dataset: 'poloclub/diffusiondb',
    config:  'large_random_100k',
    split:   'train',
    offset:  Math.floor(Math.random() * 90_000) + i * 700,
    imageField: 'image',
    name: 'diffusiondb',
  })),
  // Midjourney v6
  ...Array.from({ length: 40 }, (_, i) => ({
    dataset: 'terminusresearch/midjourney-v6-160k-raw',
    config:  'default',
    split:   'train',
    offset:  Math.floor(Math.random() * 100_000) + i * 2500,
    urlField: 'url',
    name: 'midjourney',
  })),
  // DALL-E 3 / COCO
  ...Array.from({ length: 20 }, (_, i) => ({
    dataset: 'shunk031/MSCOCO-2017-Captions-DALLE3',
    config:  'default',
    split:   'train',
    offset:  Math.floor(Math.random() * 50_000) + i * 2000,
    urlField: 'url',
    name: 'dalle3',
  })),
  // Civitai AI images
  ...Array.from({ length: 20 }, (_, i) => ({
    dataset: 'joachimsallstrom/civitai-images',
    config:  'default',
    split:   'train',
    offset:  Math.floor(Math.random() * 50_000) + i * 2500,
    urlField: 'url',
    name: 'civitai',
  })),
]

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/health') {
      return Response.json({ ok: true, role: 'cal-ai', sources: 200 }, { headers: CORS })
    }

    if (url.pathname === '/run' && req.method === 'POST') {
      return runCalibration(env)
    }

    if (url.pathname === '/status') {
      const count = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM calibration_samples WHERE label='ai'`
      ).first<{n:number}>()
      return Response.json({ ok: true, ai_samples_pending: count?.n ?? 0 }, { headers: CORS })
    }

    return Response.json({ worker: 'cal-ai', status: 'ready', sources_to_sample: 200 }, { headers: CORS })
  },
}

async function runCalibration(env: Env): Promise<Response> {
  const start    = Date.now()
  let inserted   = 0
  let failed     = 0
  const batchSize = 10  // process in batches of 10 to stay within CPU limits

  // Clear old AI samples first
  await env.DB.prepare(`DELETE FROM calibration_samples WHERE label='ai'`).run().catch(() => {})

  // Sample from all AI sources in batches
  for (let i = 0; i < AI_SOURCES.length; i += batchSize) {
    const batch = AI_SOURCES.slice(i, i + batchSize)
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
          VALUES (?, 'ai', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    ok:       true,
    inserted,
    failed,
    duration_ms: Date.now() - start,
  }, { headers: CORS })
}
