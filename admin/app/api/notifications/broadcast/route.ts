import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-middleware'
import { broadcastNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'notifications:broadcast')
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as {
    title: string
    body: string
    type?: string
    priority?: string
    target_audience?: string
    action_url?: string
    metadata?: Record<string, unknown>
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const result = await broadcastNotification({
    title: body.title,
    body: body.body,
    type: (body.type || 'system') as any,
    priority: (body.priority || 'normal') as any,
    target_audience: (body.target_audience || 'all') as any,
    action_url: body.action_url,
    metadata: body.metadata,
  })

  await logAdminAction('notification_broadcast', null, auth.ip, {
    title: body.title,
    target: body.target_audience,
    sent: result.sent,
    failed: result.failed,
  }, auth.adminId)

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    failed: result.failed,
  })
}
