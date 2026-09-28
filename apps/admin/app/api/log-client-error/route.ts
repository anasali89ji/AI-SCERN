import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { message, path, stack, userAgent } = await req.json()
  const db = getAdminDb()

  // Check if similar error exists in last hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { data: existing } = await db
    .from('error_logs')
    .select('id, count')
    .eq('message', message)
    .eq('path', path || '')
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
      path: path || '',
      stack_trace: stack || '',
      severity: 'medium',
      count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      resolved: false,
    })
  }

  return NextResponse.json({ ok: true })
}
