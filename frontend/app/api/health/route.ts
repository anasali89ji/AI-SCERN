import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// No maxDuration — this must respond instantly for uptime monitoring

export async function GET() {
  const start = Date.now()

  const checks = await Promise.allSettled([
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=1`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        signal: AbortSignal.timeout(3000),
      }
    ).then(r => ({ service: 'supabase', ok: r.ok, status: r.status })),

    Promise.resolve({
      service: 'gemini',
      ok: !!process.env.GEMINI_API_KEY,
    }),

    Promise.resolve({
      service: 'huggingface',
      ok: !!(process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN),
    }),

    Promise.resolve({
      service: 'r2',
      ok: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
    }),
  ])

  const services = Object.fromEntries(
    checks.map(c =>
      c.status === 'fulfilled'
        ? [c.value.service, { ok: c.value.ok }]
        : ['unknown', { ok: false }]
    )
  )

  return NextResponse.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    version:     '4.0.0',
    response_ms: Date.now() - start,
    services,
    env:         process.env.VERCEL_ENV || 'development',
    region:      process.env.VERCEL_REGION || 'unknown',
  })
}
