import { getAdminDb } from './db'

export interface RealtimeEvent {
  type: 'scan' | 'user_signup' | 'user_login' | 'error' | 'payment' | 'ticket' | 'announcement'
  data: Record<string, unknown>
  timestamp: string
}

let clients: Map<string, ReadableStreamDefaultController> = new Map()
let clientId = 0

export function addClient(controller: ReadableStreamDefaultController): string {
  const id = `client_${++clientId}_${Date.now()}`
  clients.set(id, controller)
  return id
}

export function removeClient(id: string): void {
  clients.delete(id)
}

export function broadcastEvent(event: RealtimeEvent): void {
  const message = `data: ${JSON.stringify(event)}\n\n`
  clients.forEach((controller, id) => {
    try {
      controller.enqueue(new TextEncoder().encode(message))
    } catch {
      removeClient(id)
    }
  })
}

// Poll database for changes and broadcast
let lastScanId: string | null = null
let lastUserId: string | null = null
let lastErrorId: string | null = null

export async function pollForChanges(): Promise<void> {
  const db = getAdminDb()

  try {
    // Check for new scans
    const { data: latestScan } = await db
      .from('scans')
      .select('id, user_id, media_type, verdict, confidence_score, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestScan && latestScan.id !== lastScanId) {
      lastScanId = latestScan.id
      broadcastEvent({
        type: 'scan',
        data: latestScan as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      })
    }

    // Check for new users
    const { data: latestUser } = await db
      .from('profiles')
      .select('id, email, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestUser && latestUser.id !== lastUserId) {
      lastUserId = latestUser.id
      broadcastEvent({
        type: 'user_signup',
        data: latestUser as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      })
    }

    // Check for new errors
    const { data: latestError } = await db
      .from('error_logs')
      .select('id, message, path, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError && latestError.id !== lastErrorId) {
      lastErrorId = latestError.id
      broadcastEvent({
        type: 'error',
        data: latestError as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (e) {
    console.error('[realtime] Poll error:', e)
  }
}

// Start polling
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    pollForChanges().catch(() => {})
  }, 3000)
}
