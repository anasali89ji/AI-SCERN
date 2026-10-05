/**
 * /detect/image -- Server Component shell.
 *
 * Boundary design:
 *   SERVER  this file, RecentImageScans, NeighbourPanel, PanelSkeleton
 *           -> Clerk auth(), Supabase service-role + pgvector queries, Data Cache; secrets
 *              (SUPABASE_SERVICE_ROLE_KEY etc.) never reach the browser bundle.
 *   CLIENT  ImageDetectorClient (file drop, upload progress, result state, feedback),
 *           VerdictMixBar (hover state)
 *           -> only interactivity ships JavaScript.
 *
 * Streaming: the uploader renders immediately; each server panel sits behind its own
 * <Suspense> boundary and streams in when its (cached) query resolves.
 *
 * Next.js 15: `searchParams` is a Promise and must be awaited.
 * Metadata + JSON-LD live in ./layout.tsx.
 */
import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import ImageDetectorClient from '@/components/detect/image/ImageDetectorClient'
import { RecentImageScans } from '@/components/detect/image/RecentImageScans'
import { NeighbourPanel } from '@/components/detect/image/NeighbourPanel'
import { PanelSkeleton } from '@/components/detect/image/PanelSkeleton'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ImageDetectionPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams])

  // Only a well-formed UUID is ever forwarded to the data layer.
  const rawScan = params.scan
  const scanId  = typeof rawScan === 'string' && UUID_RE.test(rawScan) ? rawScan : null

  return (
    <>
      <ImageDetectorClient />

      {userId && (
        <div className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-4 lg:p-8 pt-0 lg:pt-0 md:grid-cols-2 2xl:max-w-[1400px] 3xl:max-w-[1700px]">
          <Suspense fallback={<PanelSkeleton title="Recent image scans" rows={4} />}>
            <RecentImageScans userId={userId} />
          </Suspense>

          {scanId && (
            <Suspense key={scanId} fallback={<PanelSkeleton title="Similar confirmed scans" rows={1} />}>
              <NeighbourPanel userId={userId} scanId={scanId} />
            </Suspense>
          )}
        </div>
      )}
    </>
  )
}
