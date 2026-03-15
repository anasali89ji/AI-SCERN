/**
 * DETECTAI — Calibration Aggregator Worker
 * Reads all calibration_samples, computes mean+stddev per signal for AI vs Real,
 * updates calibration_state (1 row), deletes samples, logs the run.
 *
 * Also serves GET /calibration — the endpoint your Next.js API calls to get
 * the latest calibration stats for image detection.
 */

interface Env {
  DB: D1Database
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

interface Sample {
  label:         string
  entropy:       number
  noise:         number
  luminance:     number
  background:    number
  color_balance: number
  compression:   number
}

interface Stats {
  mean: number
  std:  number
}

interface CalibrationState {
  entropy_ai_mean:      number; entropy_ai_std:      number
  entropy_real_mean:    number; entropy_real_std:    number
  noise_ai_mean:        number; noise_ai_std:        number
  noise_real_mean:      number; noise_real_std:      number
  luminance_ai_mean:    number; luminance_ai_std:    number
  luminance_real_mean:  number; luminance_real_std:  number
  bg_ai_mean:           number; bg_ai_std:           number
  bg_real_mean:         number; bg_real_std:         number
  color_ai_mean:        number; color_ai_std:        number
  color_real_mean:      number; color_real_std:      number
  ai_sample_count:      number
  real_sample_count:    number
  updated_at:           string
}

function calcStats(values: number[]): Stats {
  if (!values.length) return { mean: 0, std: 1 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const std  = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 0.001
  return { mean, std }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // ── GET /calibration — returns latest stats (called by Next.js API) ──
    if (url.pathname === '/calibration') {
      const row = await env.DB.prepare(
        `SELECT * FROM calibration_state WHERE id = 1`
      ).first<CalibrationState>()

      if (!row) {
        return Response.json({
          ok:      false,
          error:   'No calibration data yet',
          message: 'Calibration not yet run. Trigger POST /run to start.',
        }, { status: 404, headers: CORS })
      }

      return Response.json({ ok: true, data: row }, { headers: CORS })
    }

    // ── GET /health ────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      const [state, samples] = await env.DB.batch([
        env.DB.prepare(`SELECT updated_at, ai_sample_count, real_sample_count FROM calibration_state WHERE id=1`),
        env.DB.prepare(`SELECT COUNT(*) as n FROM calibration_samples`),
      ])
      return Response.json({
        ok:             true,
        role:           'cal-agg',
        last_updated:   (state.results[0] as any)?.updated_at ?? 'never',
        ai_samples:     (state.results[0] as any)?.ai_sample_count ?? 0,
        real_samples:   (state.results[0] as any)?.real_sample_count ?? 0,
        pending_samples: (samples.results[0] as any)?.n ?? 0,
      }, { headers: CORS })
    }

    // ── POST /run — aggregate samples into calibration_state ──────────
    if (url.pathname === '/run' && req.method === 'POST') {
      return runAggregation(env)
    }

    return Response.json({ worker: 'cal-agg', endpoints: ['/calibration', '/health', '/run'] }, { headers: CORS })
  },
}

async function runAggregation(env: Env): Promise<Response> {
  const start = Date.now()

  // Fetch all samples
  const { results } = await env.DB.prepare(
    `SELECT label, entropy, noise, luminance, background, color_balance, compression
     FROM calibration_samples ORDER BY label`
  ).all<Sample>()

  if (!results?.length) {
    return Response.json({ ok: false, error: 'No samples in calibration_samples table' }, { headers: CORS })
  }

  const aiSamples   = results.filter(r => r.label === 'ai')
  const realSamples = results.filter(r => r.label === 'real')

  if (aiSamples.length < 10 || realSamples.length < 10) {
    return Response.json({
      ok: false,
      error: `Insufficient samples: ${aiSamples.length} AI, ${realSamples.length} real (need ≥10 each)`,
    }, { status: 400, headers: CORS })
  }

  // Compute stats per signal per class
  const fields: (keyof Sample)[] = ['entropy', 'noise', 'luminance', 'background', 'color_balance', 'compression']
  const aiStats:   Record<string, Stats> = {}
  const realStats: Record<string, Stats> = {}
  for (const f of fields) {
    aiStats[f]   = calcStats(aiSamples.map(s => s[f] as number))
    realStats[f] = calcStats(realSamples.map(s => s[f] as number))
  }

  const now = new Date().toISOString()

  // Upsert calibration_state
  await env.DB.prepare(`
    INSERT INTO calibration_state (
      id,
      entropy_ai_mean, entropy_ai_std, entropy_real_mean, entropy_real_std,
      noise_ai_mean, noise_ai_std, noise_real_mean, noise_real_std,
      luminance_ai_mean, luminance_ai_std, luminance_real_mean, luminance_real_std,
      bg_ai_mean, bg_ai_std, bg_real_mean, bg_real_std,
      color_ai_mean, color_ai_std, color_real_mean, color_real_std,
      compression_ai_mean, compression_ai_std, compression_real_mean, compression_real_std,
      ai_sample_count, real_sample_count, updated_at
    ) VALUES (
      1,
      ?,?,?,?,  ?,?,?,?,  ?,?,?,?,  ?,?,?,?,  ?,?,?,?,  ?,?,?,?,
      ?,?,?
    )
    ON CONFLICT(id) DO UPDATE SET
      entropy_ai_mean=excluded.entropy_ai_mean, entropy_ai_std=excluded.entropy_ai_std,
      entropy_real_mean=excluded.entropy_real_mean, entropy_real_std=excluded.entropy_real_std,
      noise_ai_mean=excluded.noise_ai_mean, noise_ai_std=excluded.noise_ai_std,
      noise_real_mean=excluded.noise_real_mean, noise_real_std=excluded.noise_real_std,
      luminance_ai_mean=excluded.luminance_ai_mean, luminance_ai_std=excluded.luminance_ai_std,
      luminance_real_mean=excluded.luminance_real_mean, luminance_real_std=excluded.luminance_real_std,
      bg_ai_mean=excluded.bg_ai_mean, bg_ai_std=excluded.bg_ai_std,
      bg_real_mean=excluded.bg_real_mean, bg_real_std=excluded.bg_real_std,
      color_ai_mean=excluded.color_ai_mean, color_ai_std=excluded.color_ai_std,
      color_real_mean=excluded.color_real_mean, color_real_std=excluded.color_real_std,
      compression_ai_mean=excluded.compression_ai_mean, compression_ai_std=excluded.compression_ai_std,
      compression_real_mean=excluded.compression_real_mean, compression_real_std=excluded.compression_real_std,
      ai_sample_count=excluded.ai_sample_count,
      real_sample_count=excluded.real_sample_count,
      updated_at=excluded.updated_at
  `).bind(
    aiStats.entropy.mean,     aiStats.entropy.std,     realStats.entropy.mean,     realStats.entropy.std,
    aiStats.noise.mean,       aiStats.noise.std,       realStats.noise.mean,       realStats.noise.std,
    aiStats.luminance.mean,   aiStats.luminance.std,   realStats.luminance.mean,   realStats.luminance.std,
    aiStats.background.mean,  aiStats.background.std,  realStats.background.mean,  realStats.background.std,
    aiStats.color_balance.mean, aiStats.color_balance.std, realStats.color_balance.mean, realStats.color_balance.std,
    aiStats.compression.mean, aiStats.compression.std, realStats.compression.mean, realStats.compression.std,
    aiSamples.length, realSamples.length, now,
  ).run()

  // Log this calibration run
  await env.DB.prepare(`
    INSERT INTO calibration_log (ai_count, real_count, duration_ms, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(aiSamples.length, realSamples.length, Date.now() - start).run().catch(() => {})

  // Keep only last 50 log entries
  await env.DB.prepare(`
    DELETE FROM calibration_log WHERE id NOT IN (
      SELECT id FROM calibration_log ORDER BY created_at DESC LIMIT 50
    )
  `).run().catch(() => {})

  // Delete samples — they've served their purpose
  await env.DB.prepare(`DELETE FROM calibration_samples`).run()

  return Response.json({
    ok:           true,
    ai_samples:   aiSamples.length,
    real_samples: realSamples.length,
    duration_ms:  Date.now() - start,
    stats: {
      ai:   Object.fromEntries(fields.map(f => [f, aiStats[f]])),
      real: Object.fromEntries(fields.map(f => [f, realStats[f]])),
    },
  }, { headers: CORS })
}
