/**
 * Aiscern -- server-only scan queries for the image verification page.
 *
 * Runs ONLY on the server (`server-only` makes the build fail if a Client Component
 * ever imports this). Uses the Supabase service-role client, so every query is
 * scoped by the Clerk `userId` the caller passes in -- never trust a client value.
 *
 * Caching: `unstable_cache` (Next.js Data Cache) keyed per user, tagged so the
 * Inngest `invalidate-scan-caches` function can drop exactly the stale entries when
 * a scan completes or receives feedback. `revalidate` is only a safety net.
 *
 * `auth()` / `cookies()` must NOT be called inside a cached function; callers resolve
 * the user first and pass `userId` as an argument (it is part of the cache key).
 */
import 'server-only'
import { unstable_cache } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { CACHE_TAGS } from './cache-tags'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentImageScan {
  id:               string
  file_name:        string | null
  verdict:          'AI' | 'HUMAN' | 'UNCERTAIN' | null
  confidence_score: number | null
  created_at:       string
}

export interface VerdictMix {
  ai:        number
  human:     number
  uncertain: number
  total:     number
}

export type NeighbourSummary =
  | { status: 'not_found' }
  | { status: 'unavailable' }                        // RPC missing / DB error
  | { status: 'not_indexed' }                        // scan has no embedding yet
  | {
      status:         'ok'
      neighbours:     number
      ai:             number
      human:          number
      ai_ratio:       number   // 0-1, over neighbours above the similarity threshold
      avg_similarity: number   // 0-1
    }

// ── Constants ─────────────────────────────────────────────────────────────────

const SCAN_COLUMNS      = 'id,file_name,verdict,confidence_score,created_at'
const MIX_WINDOW_DAYS   = 30
const LIST_REVALIDATE_S = 60
const NN_REVALIDATE_S   = 3600
const NN_COUNT          = 10
const NN_MIN_SIMILARITY = 0.72

// ── Uncached fetchers (throw on error so failures are never cached) ───────────

async function fetchRecentImageScans(userId: string, limit: number): Promise<RecentImageScan[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('scans')
    .select(SCAN_COLUMNS)
    .eq('user_id', userId)
    .eq('media_type', 'image')
    // status='complete' OR NULL -- same rule as /api/user/scans (older rows predate the column)
    .or('status.eq.complete,status.is.null')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`recent image scans: ${error.message}`)
  return (data ?? []) as RecentImageScan[]
}

async function fetchVerdictMix(userId: string): Promise<VerdictMix> {
  const db    = getSupabaseAdmin()
  const since = new Date(Date.now() - MIX_WINDOW_DAYS * 86_400_000).toISOString()

  const count = async (verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'): Promise<number> => {
    const { count: n, error } = await db
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'image')
      .eq('verdict', verdict)
      .or('status.eq.complete,status.is.null')
      .gte('created_at', since)
    if (error) throw new Error(`verdict mix (${verdict}): ${error.message}`)
    return n ?? 0
  }

  const [ai, human, uncertain] = await Promise.all([count('AI'), count('HUMAN'), count('UNCERTAIN')])
  return { ai, human, uncertain, total: ai + human + uncertain }
}

interface NeighbourRow {
  has_embedding:  boolean
  neighbour_count: number
  ai_count:       number
  human_count:    number
  avg_similarity: number
}

async function fetchScanNeighbours(userId: string, scanId: string): Promise<NeighbourSummary> {
  const db = getSupabaseAdmin()

  // Ownership check first: the RPC runs as service role and must never be reachable
  // for another user's scan id.
  const { data: owned, error: ownErr } = await db
    .from('scans')
    .select('id')
    .eq('id', scanId)
    .eq('user_id', userId)
    .maybeSingle()
  if (ownErr) throw new Error(`scan ownership: ${ownErr.message}`)
  if (!owned) return { status: 'not_found' }

  const { data, error } = await db.rpc('match_neighbours_for_scan', {
    p_scan_id:      scanId,
    match_count:    NN_COUNT,
    min_similarity: NN_MIN_SIMILARITY,
  })
  // Function not migrated yet (PostgREST PGRST202 / Postgres 42883) or any DB error:
  // degrade to "unavailable" and let the short revalidate retry rather than caching an error.
  if (error) return { status: 'unavailable' }

  const row = (Array.isArray(data) ? data[0] : data) as NeighbourRow | undefined
  if (!row || !row.has_embedding) return { status: 'not_indexed' }

  const n = row.neighbour_count ?? 0
  return {
    status:         'ok',
    neighbours:     n,
    ai:             row.ai_count ?? 0,
    human:          row.human_count ?? 0,
    ai_ratio:       n > 0 ? (row.ai_count ?? 0) / n : 0,
    avg_similarity: row.avg_similarity ?? 0,
  }
}

// ── Cached, tag-invalidated public API ────────────────────────────────────────

export function getRecentImageScans(userId: string, limit = 5): Promise<RecentImageScan[]> {
  return unstable_cache(
    () => fetchRecentImageScans(userId, limit),
    ['image-scans:recent', userId, String(limit)],
    { tags: [CACHE_TAGS.userScans(userId)], revalidate: LIST_REVALIDATE_S },
  )()
}

export function getImageVerdictMix(userId: string): Promise<VerdictMix> {
  return unstable_cache(
    () => fetchVerdictMix(userId),
    ['image-scans:mix', userId, String(MIX_WINDOW_DAYS)],
    { tags: [CACHE_TAGS.userScans(userId)], revalidate: LIST_REVALIDATE_S },
  )()
}

export function getScanNeighbours(userId: string, scanId: string): Promise<NeighbourSummary> {
  return unstable_cache(
    () => fetchScanNeighbours(userId, scanId),
    ['scan:neighbours', userId, scanId],
    { tags: [CACHE_TAGS.scanNeighbours(scanId)], revalidate: NN_REVALIDATE_S },
  )()
}
