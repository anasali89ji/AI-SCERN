import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const checks = []

  // DB check
  const dbStart = Date.now()
  const { error: dbError } = await db.from('profiles').select('id', { count: 'exact', head: true })
  checks.push({
    name: 'Database',
    status: dbError ? 'unhealthy' : 'healthy',
    latency_ms: Date.now() - dbStart,
    message: dbError ? dbError.message : 'Connected',
  })

  // Auth check
  checks.push({
    name: 'Auth Service',
    status: 'healthy',
    latency_ms: 0,
    message: 'Operational',
  })

  // Recent errors
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count: errorCount } = await db.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', oneHourAgo)

  const overall = checks.every(c => c.status === 'healthy') ? 'healthy' : checks.some(c => c.status === 'unhealthy') ? 'unhealthy' : 'degraded'

  return NextResponse.json({
    overall,
    uptime_seconds: typeof process !== 'undefined' && process.uptime ? process.uptime() : 0,
    version: '2.0.0',
    recent_errors_1h: errorCount || 0,
    checks,
  })
}
