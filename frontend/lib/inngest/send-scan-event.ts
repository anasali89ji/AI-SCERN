/**
 * Fire-and-forget helper — sends scan/completed to Inngest after a scan saves.
 * Non-fatal: errors are swallowed so they never block the HTTP response.
 */
import { inngest } from '@/lib/inngest/client'

interface ScanEventPayload {
  scan_id:    string
  user_id:    string
  media_type: 'text' | 'image' | 'audio' | 'video'
  verdict:    string
  confidence: number
  model_used?: string
  r2_key?:    string
}

export function fireScanCompleted(payload: ScanEventPayload): void {
  // Only fire for real (non-anonymous) users with a saved scan
  if (!payload.scan_id || !payload.user_id || payload.user_id.startsWith('anon_')) return

  void inngest
    .send({
      name: 'scan/completed',
      data: {
        scan_id:    payload.scan_id,
        user_id:    payload.user_id,
        media_type: payload.media_type,
        verdict:    (payload.verdict ?? 'UNCERTAIN') as 'AI' | 'HUMAN' | 'UNCERTAIN',
        confidence: payload.confidence ?? 0,
        model_used: payload.model_used ?? 'unknown',
        r2_key:     payload.r2_key,
      },
    })
    .catch((err: unknown) => {
      // Non-fatal — Inngest unavailable should never break detection
      console.warn('[inngest] fireScanCompleted failed:', err instanceof Error ? err.message : err)
    })
}
