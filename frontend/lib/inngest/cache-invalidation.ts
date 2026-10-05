/**
 * Aiscern -- Inngest: durable cache invalidation for the server-rendered scan panels.
 *
 * Runs inside the Next.js route handler at /api/inngest, so `revalidateTag` hits the same
 * Data Cache that `lib/server/scan-queries.ts` writes to via `unstable_cache`.
 *
 *   scan/completed -> drop the user's recent-scans + verdict-mix entries
 *   scan/feedback  -> same, plus the scan's pgvector neighbour summary (a confirmed label
 *                     triggers embedding indexing, which changes neighbour results)
 *
 * Retries are cheap and idempotent; invalidating an already-fresh tag is a no-op.
 */
import { revalidateTag } from 'next/cache'
import { inngest } from './client'
import { CACHE_TAGS } from '@/lib/server/cache-tags'

export const invalidateScanCaches = inngest.createFunction(
  {
    id:       'invalidate-scan-caches',
    name:     'Invalidate cached scan panels',
    retries:  2,
    triggers: [{ event: 'scan/completed' }, { event: 'scan/feedback' }],
  },
  async ({ event, step }) => {
    const userId: string | undefined = event.data?.user_id
    const scanId: string | undefined = event.data?.scan_id

    if (!userId || userId.startsWith('anon_') || userId === 'internal') {
      return { skipped: true, reason: 'no real user' }
    }

    const tags = await step.run('revalidate-tags', async () => {
      const list = [CACHE_TAGS.userScans(userId)]
      if (scanId && event.name === 'scan/feedback') list.push(CACHE_TAGS.scanNeighbours(scanId))
      for (const tag of list) revalidateTag(tag)
      return list
    })

    return { revalidated: tags }
  },
)

export const CACHE_INVALIDATION_FUNCTIONS = [invalidateScanCaches]
