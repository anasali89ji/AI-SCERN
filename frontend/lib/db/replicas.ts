/**
 * Aiscern — Read Replica Layer
 *
 * Two read replicas for offloading read traffic from the primary databases:
 *
 *  CONVEX REPLICA     → Convex HTTP Query API
 *                       Best for: real-time dashboard reads, user activity feeds,
 *                       notification counts, live credit balances on the profile page.
 *                       Data synced from: Supabase profiles (auth DB) via webhook/cron.
 *
 *  COCKROACHDB REPLICA → CockroachDB Serverless (separate read-only user)
 *                        Best for: analytics queries, scan history, detection stats,
 *                        bulk reads that would hammer Supabase or Neon.
 *                        Data synced from: Neon heavy DB via Inngest background job.
 *
 * Write path:  always goes to the primary (Supabase/Neon via existing db/index.ts)
 * Read path:   profile/credits/plan → Convex replica
 *              scan history/analytics → CockroachDB replica
 *
 * Env vars required:
 *   CONVEX_URL              — e.g. https://your-project.convex.cloud
 *   CONVEX_DEPLOY_KEY       — for server-side mutations/queries (secret)
 *   COCKROACH_REPLICA_URL   — read-only CockroachDB connection string
 *                             (different credentials from COCKROACH_URL write user)
 *
 * Fallback behaviour:
 *   If either replica is unavailable, all functions fall back to the primary
 *   database automatically. Replicas are NEVER required for correctness.
 */

import postgres from 'postgres'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplicaHealth {
  replica:  'convex' | 'cockroach'
  healthy:  boolean
  latency:  number
  error?:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONVEX READ REPLICA
//    Exposes typed wrappers around Convex's HTTP Query API.
//    Convex doesn't require a native driver — it's just HTTP JSON.
// ─────────────────────────────────────────────────────────────────────────────

const CONVEX_URL = process.env.CONVEX_URL ?? ''

/**
 * Low-level Convex query runner.
 * Calls Convex's HTTP API: POST /api/query
 * Docs: https://docs.convex.dev/http-api
 */
async function convexQuery<T>(
  functionPath: string,   // e.g. "users:getProfile"
  args: Record<string, unknown> = {},
): Promise<T | null> {
  if (!CONVEX_URL) {
    return null
  }

  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        // Server-side auth: Convex deploy key sent as bearer token
        ...(process.env.CONVEX_DEPLOY_KEY
          ? { Authorization: `Convex ${process.env.CONVEX_DEPLOY_KEY}` }
          : {}),
      },
      body: JSON.stringify({ path: functionPath, args }),
      // Short timeout — replica reads must not block the response
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[replica:convex] query failed (${res.status}): ${text}`)
      return null
    }

    const json = await res.json()
    // Convex returns { status: "success", value: ... } or { status: "error", ... }
    if (json.status !== 'success') {
      console.error('[replica:convex] query error:', json.errorMessage ?? json)
      return null
    }
    return json.value as T
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // AbortError = timeout — don't spam logs
    if (!msg.includes('AbortError') && !msg.includes('timed out')) {
      console.error('[replica:convex] fetch error:', msg)
    }
    return null
  }
}

// ── Convex replica: user profile & credits ────────────────────────────────────

export interface ConvexUserProfile {
  id:               string
  email:            string
  plan:             string
  credits_remaining: number
  scan_count:       number
  updated_at:       string
}

/**
 * Read a user's profile from Convex replica.
 * Returns null if replica is unavailable (caller should fall back to Supabase).
 *
 * Requires a Convex query function at: convex/users.ts → export const getProfile
 */
export async function convexGetProfile(
  userId: string,
): Promise<ConvexUserProfile | null> {
  return convexQuery<ConvexUserProfile>('users:getProfile', { userId })
}

/**
 * Read a user's current credit balance from Convex replica.
 * Faster than hitting Supabase for dashboard/profile page loads.
 */
export async function convexGetCredits(
  userId: string,
): Promise<{ credits_remaining: number; plan: string } | null> {
  return convexQuery('users:getCredits', { userId })
}

/**
 * Read recent notifications from Convex replica.
 */
export async function convexGetNotifications(
  userId: string,
  limit = 10,
): Promise<Array<{ id: string; type: string; title: string; message: string; read: boolean; created_at: string }> | null> {
  return convexQuery('notifications:list', { userId, limit })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. COCKROACHDB READ REPLICA
//    Uses a separate read-only DB user (lower privileges, COCKROACH_REPLICA_URL).
//    Same CockroachDB cluster as the analytics write path, but read-only creds.
// ─────────────────────────────────────────────────────────────────────────────

let _cockroachReplicaPool: ReturnType<typeof postgres> | null = null

function getCockroachReplicaPool(): ReturnType<typeof postgres> {
  if (_cockroachReplicaPool) return _cockroachReplicaPool

  const url = process.env.COCKROACH_REPLICA_URL
  if (!url) throw new Error('[replica:cockroach] Missing COCKROACH_REPLICA_URL')

  _cockroachReplicaPool = postgres(url, {
    prepare:         false,   // CockroachDB: disable named prepared statements
    max:             3,       // read-only pool — small footprint
    idle_timeout:    30,
    connect_timeout: 8,
    transform:       postgres.camel,
    connection: {
      application_name: 'aiscern-replica-ro',
    },
  })

  return _cockroachReplicaPool
}

/** Safe wrapper — returns null if replica pool can't connect */
async function cockroachReplicaQuery<T>(
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>,
): Promise<T | null> {
  try {
    const sql = getCockroachReplicaPool()
    return await fn(sql)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[replica:cockroach] query error:', msg)
    return null
  }
}

// ── CockroachDB replica: scan history ────────────────────────────────────────

export interface ReplicaScanRow {
  id:         string
  userId:     string
  mediaType:  string
  score:      number
  verdict:    string
  createdAt:  string
}

/**
 * Paginated scan history from CockroachDB replica.
 * Offloads Neon heavy DB from repeated history-page queries.
 *
 * NOTE: scans are replicated to CockroachDB via the Inngest
 * `sync-scan-to-replica` background job (see lib/inngest/).
 * There may be a few seconds of replication lag.
 */
export async function replicaGetScanHistory(
  userId:  string,
  limit  = 20,
  offset = 0,
): Promise<ReplicaScanRow[] | null> {
  return cockroachReplicaQuery(async sql => {
    const rows = await sql<ReplicaScanRow[]>`
      SELECT
        id,
        user_id   AS "userId",
        media_type AS "mediaType",
        score,
        verdict,
        created_at AS "createdAt"
      FROM scan_replicas
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `
    return rows
  })
}

/**
 * Per-modality detection stats for the dashboard metrics cards.
 * Reads from CockroachDB replica — no load on Neon.
 */
export async function replicaGetDetectionStats(userId: string): Promise<{
  totalScans:   number
  textScans:    number
  imageScans:   number
  audioScans:   number
  videoScans:   number
  aiDetected:   number
  humanContent: number
} | null> {
  return cockroachReplicaQuery(async sql => {
    const [row] = await sql`
      SELECT
        COUNT(*)                                          AS "totalScans",
        COUNT(*) FILTER (WHERE media_type = 'text')      AS "textScans",
        COUNT(*) FILTER (WHERE media_type = 'image')     AS "imageScans",
        COUNT(*) FILTER (WHERE media_type = 'audio')     AS "audioScans",
        COUNT(*) FILTER (WHERE media_type = 'video')     AS "videoScans",
        COUNT(*) FILTER (WHERE verdict = 'ai')           AS "aiDetected",
        COUNT(*) FILTER (WHERE verdict = 'human')        AS "humanContent"
      FROM scan_replicas
      WHERE user_id = ${userId}
    `
    return row as {
      totalScans: number; textScans: number; imageScans: number
      audioScans: number; videoScans: number; aiDetected: number; humanContent: number
    }
  })
}

/**
 * Global platform statistics (used on marketing / about pages).
 * Cached at CDN — safe to read from replica.
 */
export async function replicaGetPlatformStats(): Promise<{
  totalScans:  number
  totalUsers:  number
  aiDetected:  number
} | null> {
  return cockroachReplicaQuery(async sql => {
    const [row] = await sql`
      SELECT
        COUNT(*)                                AS "totalScans",
        COUNT(DISTINCT user_id)                 AS "totalUsers",
        COUNT(*) FILTER (WHERE verdict = 'ai') AS "aiDetected"
      FROM scan_replicas
    `
    return row as { totalScans: number; totalUsers: number; aiDetected: number }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HEALTH CHECKS
// ─────────────────────────────────────────────────────────────────────────────

export async function checkReplicaHealth(): Promise<ReplicaHealth[]> {
  const results: ReplicaHealth[] = []

  // Convex health
  const convexStart = Date.now()
  try {
    const pong = await convexQuery<{ ok: boolean }>('health:ping', {})
    results.push({
      replica: 'convex',
      healthy: pong?.ok === true,
      latency: Date.now() - convexStart,
    })
  } catch (err: unknown) {
    results.push({
      replica: 'convex',
      healthy: false,
      latency: Date.now() - convexStart,
      error:   err instanceof Error ? err.message : String(err),
    })
  }

  // CockroachDB replica health
  const crStart = Date.now()
  try {
    const sql    = getCockroachReplicaPool()
    await sql`SELECT 1 AS ping`
    results.push({ replica: 'cockroach', healthy: true, latency: Date.now() - crStart })
  } catch (err: unknown) {
    results.push({
      replica: 'cockroach',
      healthy: false,
      latency: Date.now() - crStart,
      error:   err instanceof Error ? err.message : String(err),
    })
  }

  return results
}
