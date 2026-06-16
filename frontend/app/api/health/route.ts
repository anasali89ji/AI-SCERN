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

  return NextResponse.json({
    status: 'ok',
    platform,
    region,
    uptime: uptimeSeconds,
    db: dbStatus,
    signal_worker: workerStatus,
    timestamp: new Date().toISOString(),
    version: '2.1.0',
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Health-Platform': platform,
    }
  })
}
