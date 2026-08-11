import { getAdminDb } from './db'

export interface NotificationPayload {
  user_id?: string
  title: string
  body: string
  type: 'announcement' | 'system' | 'warning' | 'promotion' | 'maintenance' | 'security'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  action_url?: string
  metadata?: Record<string, unknown>
  target_audience?: 'all' | 'free' | 'pro' | 'team' | 'enterprise'
  expires_at?: string
}

export async function createNotification(payload: NotificationPayload): Promise<string | null> {
  try {
    const db = getAdminDb()
    const { data, error } = await db.from('notifications').insert({
      user_id: payload.user_id || null,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      priority: payload.priority || 'normal',
      action_url: payload.action_url || null,
      metadata: payload.metadata || {},
      target_audience: payload.target_audience || 'all',
      expires_at: payload.expires_at || null,
      read: false,
      dismissed: false,
    }).select('id').single()

    if (error) throw error
    return data?.id as string
  } catch (e) {
    console.error('[notifications] Failed to create:', e)
    return null
  }
}

export async function broadcastNotification(
  payload: Omit<NotificationPayload, 'user_id'>
): Promise<{ sent: number; failed: number }> {
  const db = getAdminDb()
  let query = db.from('profiles').select('id')

  if (payload.target_audience && payload.target_audience !== 'all') {
    query = query.eq('plan', payload.target_audience)
  }

  const { data: users, error } = await query
  if (error || !users) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  // Batch insert notifications for all users
  const notifications = users.map((u: any) => ({
    user_id: u.id,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    priority: payload.priority || 'normal',
    action_url: payload.action_url || null,
    metadata: payload.metadata || {},
    target_audience: payload.target_audience || 'all',
    expires_at: payload.expires_at || null,
    read: false,
    dismissed: false,
  }))

  // Insert in batches of 100
  const batchSize = 100
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize)
    try {
      const { error: insertErr } = await db.from('notifications').insert(batch)
      if (insertErr) {
        failed += batch.length
      } else {
        sent += batch.length
      }
    } catch {
      failed += batch.length
    }
  }

  return { sent, failed }
}

export async function notifyAnnouncementPublished(
  announcementId: string,
  title: string,
  content: string,
  targetAudience: string,
  type: string
): Promise<{ sent: number; failed: number }> {
  return broadcastNotification({
    title,
    body: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
    type: type as any,
    priority: type === 'warning' || type === 'maintenance' ? 'high' : 'normal',
    target_audience: targetAudience as any,
    action_url: '/dashboard',
    metadata: { announcement_id: announcementId },
  })
}
