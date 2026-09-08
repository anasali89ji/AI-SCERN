/**
 * Aiscern — Replica Sync Inngest Jobs
 *
 * Background jobs that replicate write-path data to read replicas:
 *
 *  syncScanToReplica    — triggered after every scan/completed event.
 *                         Writes the scan row into CockroachDB scan_replicas table.
 *
 *  syncProfileToConvex  — triggered after every profile.updated event
 *                         (plan upgrades, credit changes).
 *                         Writes the profile snapshot to Convex for fast reads.
 *
 *  replicaHealthCheck   — nightly cron that pings both replicas and logs results.
 *
 * Both sync jobs are idempotent (upsert on primary key).
 * Both fall back gracefully — a replica failure never breaks the scan pipeline.
 */

import { inngest } from './client'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Replicate completed scan → CockroachDB scan_replicas
// ─────────────────────────────────────────────────────────────────────────────

export const syncScanToReplica = inngest.createFunction(
  {
    id:   'sync-scan-to-replica',
    name: 'Sync completed scan to CockroachDB replica',
    triggers: [{ event: 'scan/completed' }],
    retries: 3,
    // Don't block forensic cascade — this runs in parallel
    concurrency: { limit: 20 },
  },
  async ({ event, step }) => {
    const { scan_id, user_id, media_type, score, verdict, confidence, created_at } = event.data

    if (!scan_id || !user_id || user_id.startsWith('anon_')) {
      return { skipped: true, reason: 'anon or missing scan_id' }
    }

    await step.run('upsert-scan-replica', async () => {
      // Use write analytics DB (same cluster, different table)
      const { getAnalyticsDb } = await import('@/lib/db')
      const { sql } = getAnalyticsDb()

      await sql`
        INSERT INTO scan_replicas (
          id,
          user_id,
          media_type,
          score,
          verdict,
          confidence,
          created_at
        ) VALUES (
          ${scan_id},
          ${user_id},
          ${media_type ?? 'unknown'},
          ${score ?? 0},
          ${verdict ?? 'unknown'},
          ${confidence ?? 0},
          ${created_at ?? new Date().toISOString()}
        )
        ON CONFLICT (id) DO UPDATE SET
          score      = EXCLUDED.score,
          verdict    = EXCLUDED.verdict,
          confidence = EXCLUDED.confidence
      `
    })

    return { synced: true, scan_id }
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// 2. Replicate profile changes → Convex
//    Triggered by: plan upgrades, credit grants, profile updates
// ─────────────────────────────────────────────────────────────────────────────

export const syncProfileToConvex = inngest.createFunction(
  {
    id:   'sync-profile-to-convex',
    name: 'Sync profile snapshot to Convex replica',
    triggers: [{ event: 'profile/updated' }],
    retries: 3,
    concurrency: { limit: 10 },
  },
  async ({ event, step }) => {
    const { user_id } = event.data

    if (!user_id) return { skipped: true, reason: 'missing user_id' }

    // Step 1: fetch fresh profile from Supabase (source of truth)
    const profile = await step.run('fetch-profile', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('profiles')
        .select('id, email, plan, plan_id, credits_remaining, scan_count, updated_at')
        .eq('id', user_id)
        .maybeSingle()

      if (error || !data) {
        throw new Error(`[syncProfileToConvex] profile fetch failed: ${error?.message ?? 'not found'}`)
      }
      return data
    })

    // Step 2: push to Convex via HTTP Mutation API
    await step.run('push-to-convex', async () => {
      const convexUrl = process.env.CONVEX_URL
      if (!convexUrl) {
        return { skipped: true }
      }

      const res = await fetch(`${convexUrl}/api/mutation`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CONVEX_DEPLOY_KEY
            ? { Authorization: `Convex ${process.env.CONVEX_DEPLOY_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          path: 'users:upsertProfile',
          args: {
            id:               profile.id,
            email:            profile.email,
            plan:             profile.plan,
            plan_id:          profile.plan_id,
            credits_remaining: profile.credits_remaining,
            scan_count:       profile.scan_count,
            updated_at:       profile.updated_at,
          },
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`[syncProfileToConvex] Convex mutation failed (${res.status}): ${text}`)
      }

      const json = await res.json()
      if (json.status !== 'success') {
        throw new Error(`[syncProfileToConvex] Convex error: ${json.errorMessage ?? JSON.stringify(json)}`)
      }

      return { ok: true }
    })

    return { synced: true, user_id, plan: profile.plan }
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// 3. Nightly replica health check
// ─────────────────────────────────────────────────────────────────────────────

export const replicaHealthCheck = inngest.createFunction(
  {
    id:   'replica-health-check',
    name: 'Nightly replica health check',
    triggers: [{ cron: '0 2 * * *' }],   // 02:00 UTC = 07:00 PKT
  },
  async ({ step }) => {
    const results = await step.run('check-replicas', async () => {
      const { checkReplicaHealth } = await import('@/lib/db/replicas')
      return checkReplicaHealth()
    })

    await step.run('log-results', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()

      for (const r of results) {
        // Log to admin_activity_logs for visibility in the admin dashboard
        try {
          await sb.from('admin_activity_logs').insert({
            admin_id:   'system',
            action:     `replica_health_${r.replica}`,
            target_id:  'system',
            details:    { healthy: r.healthy, latency_ms: r.latency, error: r.error ?? null },
            created_at: new Date().toISOString(),
          })
        } catch { /* non-fatal */ }
      }

      return results
    })

    const unhealthy = results.filter(r => !r.healthy)
    if (unhealthy.length > 0) {
      console.error('[replicaHealthCheck] Unhealthy replicas:', unhealthy)
    }

    return { checked_at: new Date().toISOString(), results }
  },
)

export const REPLICA_SYNC_FUNCTIONS = [
  syncScanToReplica,
  syncProfileToConvex,
  replicaHealthCheck,
]
