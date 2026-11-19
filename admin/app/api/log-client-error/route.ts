import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

/**
 * ADMIN-LOG-1 (audit 2026-11): this endpoint is intentionally unauthenticated
 * (client errors must be loggable from the login page before a session
 * exists) which makes it the admin app's only unauthenticated write path.
 * Previously it had NO rate limit, NO payload caps and an unguarded
 * req.json() — an attacker could flood `error_logs` with unbounded unique
 * message/path pairs (each < 1h-old pair = one row) or crash it with
 * malformed JSON. Now: per-IP in-memory rate limit (admin panel traffic is
 * a handful of operators — in-memory is sufficient and needs no Upstash
 * dependency here), strict field caps, and safe JSON parsing.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const b = rateBuckets.get(ip)
  if (!b || now > b.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  b.count++
  return b.count > MAX_PER_WINDOW
}

// Periodic sweep so the map cannot grow unbounded across unique IPs.
if (typeof globalThis !== 'undefined') {
  const g = globalThis as unknown as { __adminErrLogSweep?: NodeJS.Timeout }
  if (!g.__adminErrLogSweep) {
    g.__adminErrLogSweep = setInterval(() => {
      const now = Date.now()
      for (const [ip, b] of rateBuckets) {
        if (now > b.resetAt) rateBuckets.delete(ip)
      }
    }, WINDOW_MS)
    g.__adminErrLogSweep.unref?.()
  }
}

const cap = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.slice(0, max) : ''

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  let body: { message?: unknown; path?: unknown; stack?: unknown; userAgent?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const message = cap(body.message, 2000)
  const path = cap(body.path, 500)
  const stack = cap(body.stack, 4000)
  const userAgent = cap(body.userAgent, 300)

  if (!message) {
    return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 })
  }

  const db = getAdminDb()

  // Check if similar error exists in last hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { data: existing } = await db
    .from('error_logs')
    .select('id, count')
    .eq('message', message)
    .eq('path', path)
    .gte('created_at', oneHourAgo)
    .limit(1)
    .single()

  if (existing) {
    await db.from('error_logs').update({
      count: (existing.count || 1) + 1,
      last_seen: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await db.from('error_logs').insert({
      message,
      path,
      stack_trace: stack,
      severity: 'medium',
      count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      resolved: false,
    })
  }

  return NextResponse.json({ ok: true })
}
