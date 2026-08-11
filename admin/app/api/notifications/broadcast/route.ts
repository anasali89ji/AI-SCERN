import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { title, body, type, priority, target_audience, action_url } = await req.json()
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 })

  const db = getAdminDb()

  if (target_audience === 'all') {
    const { error } = await db.from('notifications').insert({
      user_id: null,
      title,
      body,
      type: type || 'system',
      priority: priority || 'normal',
      target_audience: 'all',
      read: false,
      action_url: action_url || null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { data: users } = await db.from('profiles').select('id').eq('plan', target_audience)
    const inserts = (users || []).map(u => ({
      user_id: u.id,
      title,
      body,
      type: type || 'system',
      priority: priority || 'normal',
      target_audience,
      read: false,
      action_url: action_url || null,
    }))
    if (inserts.length > 0) {
      const { error } = await db.from('notifications').insert(inserts)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await db.from('admin_audit_log').insert({
    action: 'notification_broadcast',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { title, target_audience },
  })

  return NextResponse.json({ ok: true, sent: target_audience === 'all' ? 'broadcast' : 'targeted' })
}
