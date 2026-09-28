/**
 * Aiscern — MotherDuck Client (durable scan archive + analytics)
 *
 * Why MotherDuck sits next to Supabase instead of replacing it:
 *  - Supabase `scans` is the HOT path — every detect route writes/reads it
 *    synchronously, and it's subject to each user's `data_retention_days`
 *    purge (v18_data_retention_cron.sql). Good for a live dashboard, bad for
 *    "find the exact image I scanned 3 years ago."
 *  - MotherDuck (hosted DuckDB) is the COLD/durable path — an Inngest job
 *    (lib/inngest/functions.ts: archiveScanToMotherDuck) copies each
 *    completed scan's metadata + perceptual hash here after the fact, so it
 *    survives the Supabase purge and stays fast to query even with millions
 *    of rows (columnar, built for exactly this kind of historical scan/
 *    analytics query — which is also what makes it a good fit for
 *    enterprise/HR-firm report generation across large scan histories).
 *
 * Required env vars:
 *   MOTHERDUCK_TOKEN     — service token from motherduck.com (Settings > Tokens)
 *   MOTHERDUCK_DATABASE  — database name, default 'aiscern_archive'
 *
 * Degrades gracefully: if the token isn't configured, or a query fails,
 * callers get `null`/`[]` back rather than throwing — archiving and report
 * generation should never take down the live detect flow.
 */
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api'
import type { DuckDBValue } from '@duckdb/node-api'

const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'aiscern_archive'

let _instance: DuckDBInstance | null = null
let _connection: DuckDBConnection | null = null
let _initPromise: Promise<DuckDBConnection | null> | null = null

function isConfigured(): boolean {
  return !!process.env.MOTHERDUCK_TOKEN
}

async function connect(): Promise<DuckDBConnection | null> {
  if (!isConfigured()) return null
  if (_connection) return _connection

  const token = process.env.MOTHERDUCK_TOKEN!
  const connString = `md:${MOTHERDUCK_DATABASE}?motherduck_token=${token}`

  _instance = await DuckDBInstance.create(connString)
  _connection = await _instance.connect()
  return _connection
}

/**
 * Get a MotherDuck connection, initializing the schema on first use.
 * Returns null if MotherDuck isn't configured or connection fails —
 * every caller must handle that (treat as "archive unavailable").
 */
export async function getMotherDuckConnection(): Promise<DuckDBConnection | null> {
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    try {
      const conn = await connect()
      if (!conn) return null
      await ensureSchema(conn)
      return conn
    } catch (err) {
      console.warn('[motherduck] connection failed:', err instanceof Error ? err.message : err)
      _connection = null
      _instance = null
      return null
    }
  })()

  const result = await _initPromise
  if (!result) _initPromise = null // allow retry on next call instead of caching a permanent failure
  return result
}

async function ensureSchema(conn: DuckDBConnection): Promise<void> {
  // Idempotent — safe to run on every cold start.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS scan_archive (
      scan_id           VARCHAR PRIMARY KEY,
      user_id           VARCHAR NOT NULL,
      media_type        VARCHAR NOT NULL,
      verdict           VARCHAR,
      confidence_score  DOUBLE,
      model_used        VARCHAR,
      file_name         VARCHAR,
      file_size         BIGINT,
      r2_key            VARCHAR,
      file_hash         VARCHAR,
      perceptual_hash   VARCHAR,
      signals           JSON,
      metadata          JSON,
      processing_time   INTEGER,
      scanned_at        TIMESTAMP,
      archived_at       TIMESTAMP DEFAULT current_timestamp
    );
  `)

  // Indexes on scan_id/user_id are implicit via the primary key + DuckDB's
  // columnar storage; perceptual_hash lookups (findByFingerprint) scan the
  // media_type='image' subset, which stays fast at Aiscern's realistic scale.
}

export async function closeMotherDuckConnection(): Promise<void> {
  // Mostly for tests/scripts — serverless functions let the process die naturally.
  try { _connection?.disconnectSync() } catch { /* ignore */ }
  _connection = null
  _instance = null
  _initPromise = null
}

/**
 * Generic ad-hoc query helper for analytics routes (app/api/analytics/*).
 * Returns null (not []) on failure/unconfigured, so callers can distinguish
 * "no data" from "archive unavailable" and respond with 503 instead of a
 * misleading empty chart.
 *
 * NOTE: build queries with parameterized values where possible. The
 * analytics routes in this codebase interpolate trusted, server-computed
 * values only (ISO dates, the authenticated userId) — never raw user input —
 * consistent with how the rest of the app's raw-SQL helpers are used.
 */
export async function queryMotherDuck<T = Record<string, unknown>>(
  sql: string,
  params: DuckDBValue[] = [],
): Promise<T[] | null> {
  const conn = await getMotherDuckConnection()
  if (!conn) return null
  try {
    const reader = await conn.runAndReadAll(sql, params)
    return reader.getRowObjects() as unknown as T[]
  } catch (err) {
    console.warn('[motherduck] queryMotherDuck failed:', err instanceof Error ? err.message : err)
    return null
  }
}
