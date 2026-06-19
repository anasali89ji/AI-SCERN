/**
 * Aiscern Trust Platform — Inngest Background Functions
 *
 * Handles asynchronous Trust Platform workloads:
 *   - Periodic audit log timestamp anchoring (tamper-evidence checkpoints)
 *   - Webhook delivery for verification.completed events
 *   - Report generation queueing (PDF/CSV to R2)
 *
 * Registered in app/api/inngest/route.ts alongside existing functions.
 */

import { inngest }          from './client'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// ── 1. Periodic audit chain anchor (every hour) ───────────────────────────────
export const auditChainAnchor = inngest.createFunction(
  {
    id:      'audit-chain-anchor',
    name:    'Create periodic audit chain timestamp anchor',
    retries: 2,
    triggers: [{ cron: '0 * * * *' }],  // every hour
  },
  async ({ step }: { step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    return step.run('create-anchor', async () => {
      const sb = getSupabaseAdmin()
      const { data, error } = await sb.rpc('create_timestamp_anchor', { p_anchor_type: 'periodic' })
      if (error) {
        console.error('[audit-chain-anchor]', error.message)
        return { anchored: false, error: error.message }
      }
      return { anchored: !!data, anchor_id: data }
    })
  }
)

// ── 2. Webhook delivery on verification completed ────────────────────────────
export const deliverVerificationWebhook = inngest.createFunction(
  {
    id:          'deliver-verification-webhook',
    name:        'Deliver webhook on verification completed',
    retries:     3,
    concurrency: { limit: 10 },
    triggers:    [{ event: 'verification/completed' }],
  },
  async ({ event, step }) => {
    const { verification_id, user_id } = event.data as {
      verification_id: string
      user_id:          string
    }

    const webhooks = await step.run('fetch-webhooks', async () => {
      const sb = getSupabaseAdmin()
      const { data } = await sb
        .from('webhooks')
        .select('id, url, secret, events')
        .eq('user_id', user_id)
        .eq('is_active', true)
      return data ?? []
    })

    const relevant = webhooks.filter(
      (w: { events: string[] }) => w.events.includes('verification.completed')
    )

    if (relevant.length === 0) return { delivered: 0 }

    let delivered = 0
    for (const wh of relevant) {
      await step.run(`deliver-${wh.id}`, async () => {
        const sb = getSupabaseAdmin()
        const { data: verification } = await sb
          .from('verifications')
          .select('*, trust_scores(*)')
          .eq('id', verification_id)
          .single()

        const payload = {
          event:           'verification.completed',
          verification_id,
          data:            verification,
          timestamp:       new Date().toISOString(),
        }

        try {
          const sigKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(wh.secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          )
          const sigBuf = await crypto.subtle.sign('HMAC', sigKey, new TextEncoder().encode(JSON.stringify(payload)))
          const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

          const res = await fetch(wh.url, {
            method:  'POST',
            headers: {
              'Content-Type':         'application/json',
              'X-Aiscern-Signature':  signature,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
          })

          await sb.from('webhook_deliveries').insert({
            webhook_id:      wh.id,
            verification_id,
            event_type:      'verification.completed',
            payload,
            status_code:     res.status,
          })

          if (res.ok) {
            await sb.from('webhooks').update({
              last_triggered_at: new Date().toISOString(),
              failure_count:      0,
            }).eq('id', wh.id)
            delivered++
          } else {
            try {
              await sb.rpc('increment_webhook_failures', { p_webhook_id: wh.id })
            } catch { /* non-fatal */ }
          }
        } catch (err) {
          console.error('[deliver-verification-webhook]', err)
          const sb2 = getSupabaseAdmin()
          try {
            await sb2.from('webhooks').update({
              last_error: err instanceof Error ? err.message : 'unknown error',
            }).eq('id', wh.id)
          } catch { /* non-fatal */ }
        }
      })
    }

    return { delivered, attempted: relevant.length }
  }
)

// ── All Trust Platform functions ──────────────────────────────────────────────
export const TRUST_PLATFORM_FUNCTIONS = [
  auditChainAnchor,
  deliverVerificationWebhook,
]
