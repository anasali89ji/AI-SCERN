/**
 * Aiscern — MotherDuck Archive Operations
 *
 * See lib/motherduck/client.ts for why this exists alongside Supabase.
 * Every function here is best-effort: on failure it logs and returns a
 * safe fallback (never throws) so the archive being down never breaks a
 * live scan or blocks a response to the user.
 */
import { getMotherDuckConnection } from './client'

export interface ArchivedScanInput {
  scan_id: string
  user_id: string
  media_type: string
  verdict: string | null
  confidence_score: number | null
  model_used: string | null
  file_name: string | null
  file_size: number | null
  r2_key: string | null
  file_hash: string | null
  perceptual_hash: string | null
  signals: unknown
  metadata: unknown
  processing_time: number | null
  scanned_at: string // ISO timestamp of the original scan (scans.created_at)
}

/** Copy a completed scan into the durable MotherDuck archive. Called from Inngest, not the hot path. */
export async function archiveScan(input: ArchivedScanInput): Promise<boolean> {
  const conn = await getMotherDuckConnection()
  if (!conn) return false

  try {
    const appender = await conn.run(
      `INSERT OR REPLACE INTO scan_archive
        (scan_id, user_id, media_type, verdict, confidence_score, model_used,
         file_name, file_size, r2_key, file_hash, perceptual_hash, signals,
         metadata, processing_time, scanned_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        input.scan_id,
        input.user_id,
        input.media_type,
        input.verdict,
        input.confidence_score,
        input.model_used,
        input.file_name,
        input.file_size,
        input.r2_key,
        input.file_hash,
        input.perceptual_hash,
        JSON.stringify(input.signals ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.processing_time,
        input.scanned_at,
      ],
    )
    void appender
    return true
  } catch (err) {
    console.warn('[motherduck] archiveScan failed:', err instanceof Error ? err.message : err)
    return false
  }
}

export interface FingerprintMatch {
  scan_id: string
  user_id: string
  verdict: string | null
  confidence_score: number | null
  file_name: string | null
  r2_key: string | null
  scanned_at: string
  hamming_distance: number
}

/**
 * Find prior scans whose perceptual hash is within `maxDistance` bits of
 * the given hash — i.e. "this looks like an image we've already scanned,"
 * even if it's been recompressed/resized/cropped since. Scoped to the same
 * user by default (cross-user matching is a product decision, not a given —
 * pass `sameUserOnly: false` explicitly for platform-wide dedup/abuse checks).
 */
export async function findByFingerprint(
  perceptualHashHex: string,
  opts: { userId?: string; sameUserOnly?: boolean; maxDistance?: number; limit?: number } = {},
): Promise<FingerprintMatch[]> {
  const conn = await getMotherDuckConnection()
  if (!conn) return []

  const maxDistance = opts.maxDistance ?? 10
  const limit = opts.limit ?? 5
  const sameUserOnly = opts.sameUserOnly !== false // default true

  try {
    // DuckDB doesn't have a native hex-Hamming-distance function, so we
    // compare via bit_count(xor) on the hash reinterpreted as a 64-bit int.
    // This scans the (media_type='image') subset — fine at Aiscern's scale;
    // if it ever needs to scale further, precompute phash_int at archive
    // time (mirroring scans.phash_int in Postgres) and index on that.
    const userFilter = sameUserOnly && opts.userId ? `AND user_id = $2` : ''
    const params: unknown[] = [perceptualHashHex]
    if (sameUserOnly && opts.userId) params.push(opts.userId)

    const reader = await conn.runAndReadAll(
      `WITH candidates AS (
         SELECT scan_id, user_id, verdict, confidence_score, file_name, r2_key, scanned_at,
                bit_count(('x' || $1)::BIT ^ ('x' || perceptual_hash)::BIT) AS hamming_distance
         FROM scan_archive
         WHERE media_type = 'image'
           AND perceptual_hash IS NOT NULL
           ${userFilter}
       )
       SELECT * FROM candidates
       WHERE hamming_distance <= ${maxDistance}
       ORDER BY hamming_distance ASC, scanned_at DESC
       LIMIT ${limit}`,
      params,
    )
    return reader.getRowObjects() as unknown as FingerprintMatch[]
  } catch (err) {
    console.warn('[motherduck] findByFingerprint failed:', err instanceof Error ? err.message : err)
    return []
  }
}

export interface ScanHistoryRow {
  scan_id: string
  media_type: string
  verdict: string | null
  confidence_score: number | null
  model_used: string | null
  file_name: string | null
  file_size: number | null
  r2_key: string | null
  perceptual_hash: string | null
  signals: string | null
  metadata: string | null
  scanned_at: string
}

/**
 * Fetch a single archived scan by ID — used when a scan's Supabase row has
 * already been purged by data-retention but the user (or an enterprise
 * report) still needs it. This is the "user comes back after 3 years" path.
 */
export async function getArchivedScan(scanId: string): Promise<ScanHistoryRow | null> {
  const conn = await getMotherDuckConnection()
  if (!conn) return null
  try {
    const reader = await conn.runAndReadAll(
      `SELECT * FROM scan_archive WHERE scan_id = $1`,
      [scanId],
    )
    const rows = reader.getRowObjects() as unknown as ScanHistoryRow[]
    return rows[0] ?? null
  } catch (err) {
    console.warn('[motherduck] getArchivedScan failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Fetch all archived scans for a user within a date range — feeds enterprise report generation. */
export async function getScanHistoryForReport(
  userId: string,
  opts: { fromDate?: string; toDate?: string; mediaType?: string; limit?: number } = {},
): Promise<ScanHistoryRow[]> {
  const conn = await getMotherDuckConnection()
  if (!conn) return []

  const limit = opts.limit ?? 500
  const filters: string[] = ['user_id = $1']
  const params: unknown[] = [userId]

  if (opts.fromDate) { params.push(opts.fromDate); filters.push(`scanned_at >= $${params.length}`) }
  if (opts.toDate)   { params.push(opts.toDate);   filters.push(`scanned_at <= $${params.length}`) }
  if (opts.mediaType) { params.push(opts.mediaType); filters.push(`media_type = $${params.length}`) }

  try {
    const reader = await conn.runAndReadAll(
      `SELECT * FROM scan_archive WHERE ${filters.join(' AND ')} ORDER BY scanned_at DESC LIMIT ${limit}`,
      params,
    )
    return reader.getRowObjects() as unknown as ScanHistoryRow[]
  } catch (err) {
    console.warn('[motherduck] getScanHistoryForReport failed:', err instanceof Error ? err.message : err)
    return []
  }
}
