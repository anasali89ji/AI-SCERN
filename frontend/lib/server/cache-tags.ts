/**
 * Aiscern -- cache tag names for `unstable_cache` / `revalidateTag`.
 *
 * Pure constants (no secrets, no `server-only`) so both the data layer and the
 * Inngest invalidation function can import them without drifting apart.
 */
export const CACHE_TAGS = {
  /** Everything derived from one user's scan list (recent scans, verdict mix). */
  userScans: (userId: string) => `user:${userId}:scans`,
  /** pgvector neighbour summary for one scan. */
  scanNeighbours: (scanId: string) => `scan:${scanId}:neighbours`,
} as const
