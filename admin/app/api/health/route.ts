import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const START_TIME = Date.now()

async function checkSupabase(db: ReturnType<typeof getAdminDb>) {
  const t0 = Date.now()
  try {
    await db.from('profiles').select('id', { count: 'exact', head: true })
    return { name: 'Supabase DB', status: 'healthy' as const, latency_ms: Date.now() - t0, checked_at: new Date().toISOString() }
  } catch (e) {
    return { name: 'Supabase DB', status: 'down' as const, message: String(e), checked_at: new Date().toISOString() }
  }
}

async function checkUpstash() {
  const t0 = Date.now()
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { name: 'Upstash Redis', status: 'degraded' as const, message: 'Not configured', checked_at: new Date().toISOString() }
  try {
    const res = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { name: 'Upstash Redis', status: 'healthy' as const, latency_ms: Date.now() - t0, checked_at: new Date().toISOString() }
  } catch (e) {
    return { name: 'Upstash Redis', status: 'down' as const, message: String(e), checked_at: new Date().toISOString() }
  }
}

async function checkHuggingFace() {
  const t0 = Date.now()
  const token = process.env.HF_API_TOKEN
  if (!token) return { name: 'HuggingFace API', status: 'degraded' as const, message: 'HF_API_TOKEN not set', checked_at: new Date().toISOString() }
  try {
    const res = await fetch('https://huggingface.co/api/whoami', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { name: 'HuggingFace API', status: 'healthy' as const, latency_ms: Date.now() - t0, checked_at: new Date().toISOString() }
  } catch (e) {
    return { name: 'HuggingFace API', status: 'down' as const, message: String(e), checked_at: new Date().toISOString() }
  }
}

async function checkResend() {
  const t0 = Date.now()
  const key = process.env.RESEND_API_KEY
  if (!key) return { name: 'Resend Email', status: 'degraded' as const, message: 'RESEND_API_KEY not set', checked_at: new Date().toISOString() }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    return { name: 'Resend Email', status: 'healthy' as const, latency_ms: Date.now() - t0, checked_at: new Date().toISOString() }
  } catch (e) {
    return { name: 'Resend Email', status: 'down' as const, message: String(e), checked_at: new Date().toISOString() }
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const checks = await Promise.all([
    checkSupabase(db),
    checkUpstash(),
    checkHuggingFace(),
    checkResend(),
    Promise.resolve({ name: 'Admin Session Store', status: 'healthy' as const, checked_at: new Date().toISOString() }),
  ])

  const hasDown = checks.some(c => c.status === 'down')
  const hasDegraded = checks.some(c => c.status === 'degraded')
  const overall = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy'

  // Get recent error count
  const { count: recentErrors } = await db
    .from('error_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())

  return NextResponse.json({
    overall,
    checks,
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    version: process.env.npm_package_version ?? '2.0.0',
    recent_errors_1h: recentErrors ?? 0,
  })
}
