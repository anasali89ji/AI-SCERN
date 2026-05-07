import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

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

  return NextResponse.json({
    status: 'ok',
    platform,
    region,
    uptime: uptimeSeconds,
    db: dbStatus,
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Health-Platform': platform,
    }
  })
}
