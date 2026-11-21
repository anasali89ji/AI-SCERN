import { NextResponse } from 'next/server'

// Edge runtime: always dynamic by nature — no `force-dynamic` needed
export const runtime = 'edge'

const START_TIME = Date.now()

export async function GET() {
  const platform = process.env.DEPLOYMENT_PLATFORM || 'unknown'
  const region   = process.env.VERCEL_REGION || process.env.CF_PAGES_BRANCH || 'unknown'

  // Quick DB check (timeout after 2s)
  let dbStatus = 'unknown'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/check_and_increment_rate_limit`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_ip: 'health-check', p_max: 1000, p_window_minutes: 1 }),
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    dbStatus = res.ok ? 'ok' : 'degraded'
  } catch {
    dbStatus = 'timeout'
  }

  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000)

  // C.2.1 — signal-worker (Python CV) health check (carries 25% image-detection weight)
  let workerStatus: 'ok' | 'offline' | 'unconfigured' = 'unconfigured'
  const workerUrl = process.env.PYTHON_WORKER_URL
  if (workerUrl) {
    try {
      const wCtl = new AbortController()
      const wTmo = setTimeout(() => wCtl.abort(), 3000)
      const wRes = await fetch(`${workerUrl}/health`, { signal: wCtl.signal })
      clearTimeout(wTmo)
      workerStatus = wRes.ok ? 'ok' : 'offline'
    } catch {
      workerStatus = 'offline'
    }
  }

  // IMG-WORKER-1 — HF ZeroGPU Space (L5/L5b) probe. Reads the Space's Gradio
  // /config (CPU-only, burns no GPU quota) and verifies the api_names the
  // frontend's callGpuWorker() depends on actually exist. A Space running
  // different code than hf-space-gpu-worker/ is reported as 'api-mismatch'
  // with the observed function list — that state makes every L5/L5b call fail
  // with 404 and previously surfaced only as a bare "GPU worker unavailable".
  let gpuWorkerStatus: 'ok' | 'api-mismatch' | 'offline' | 'unconfigured' = 'unconfigured'
  let gpuWorkerDetail: string | null = null
  const gpuUrl = process.env.HF_GPU_WORKER_URL
  if (gpuUrl) {
    try {
      const gCtl = new AbortController()
      const gTmo = setTimeout(() => gCtl.abort(), 5000)
      const gRes = await fetch(`${gpuUrl}/config`, { signal: gCtl.signal })
      clearTimeout(gTmo)
      if (gRes.ok) {
        const cfg   = await gRes.json() as { dependencies?: { api_name?: string | false }[] }
        const names = [...new Set((cfg.dependencies ?? [])
          .map(d => d.api_name)
          .filter((n): n is string => typeof n === 'string'))]
        const hasL5  = names.includes('diffusion_inversion')
        const hasL5b = names.includes('diffusion_snapback')
        if (hasL5 && hasL5b) {
          gpuWorkerStatus = 'ok'
        } else {
          gpuWorkerStatus = 'api-mismatch'
          gpuWorkerDetail = `Space exposes [${names.join(', ')}] but the frontend calls diffusion_inversion + diffusion_snapback — redeploy the Space from hf-space-gpu-worker/ (see docs/IMG_WORKER_RECOVERY.md)`
        }
      } else {
        gpuWorkerStatus = 'offline'
        gpuWorkerDetail = `GET /config returned HTTP ${gRes.status}`
      }
    } catch (err) {
      gpuWorkerStatus = 'offline'
      gpuWorkerDetail = err instanceof Error ? err.message : 'fetch failed'
    }
  }

  // MODULE 5 — Failure Visibility. Extends the per-worker status pattern
  // established above (C.2.1) to the paid-vendor fallback sources, so a
  // single endpoint gives full-system degraded-mode visibility for ops
  // rather than only covering the self-hosted worker.
  //
  // These are configuration/key-presence checks, not live round-trip calls —
  // a live "burn a real request" health check against paid vendors is
  // deliberately avoided here (cost + would itself consume rate limit /
  // quota on every health poll). Presence of a key is what these track;
  // actual per-request failures are surfaced via degraded_signals on the
  // detection responses themselves (see hf-analyze.ts DetectionResult).
  const geminiStatus: 'configured' | 'unconfigured' =
    (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2) ? 'configured' : 'unconfigured'

  const nvidiaNimStatus: 'configured' | 'unconfigured' =
    (process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY) ? 'configured' : 'unconfigured'

  const hfStatus: 'configured' | 'unconfigured' =
    (process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN) ? 'configured' : 'unconfigured'

  return NextResponse.json({
    status: 'ok',
    platform,
    region,
    uptime: uptimeSeconds,
    db: dbStatus,
    signal_worker: workerStatus,
    // IMG-WORKER-1 — ZeroGPU Space status alongside signal_worker above
    gpu_worker: gpuWorkerStatus,
    gpu_worker_detail: gpuWorkerDetail,
    // MODULE 5 — per-vendor fallback visibility, alongside signal_worker above
    gemini: geminiStatus,
    nvidia_nim: nvidiaNimStatus,
    huggingface: hfStatus,
    timestamp: new Date().toISOString(),
    version: '2.3.0',
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Health-Platform': platform,
    }
  })
}
