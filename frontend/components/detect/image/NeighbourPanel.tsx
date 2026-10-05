/**
 * Server Component (async). Streams the pgvector "similar confirmed scans" summary for
 * one scan. The similarity search runs inside Postgres (match_neighbours_for_scan, see
 * supabase/migrations/v41_scan_neighbours_rpc.sql); the server only sends a scan id and
 * receives a handful of numbers back.
 */
import { getScanNeighbours } from '@/lib/server/scan-queries'

export async function NeighbourPanel({ userId, scanId }: { userId: string; scanId: string }) {
  let summary: Awaited<ReturnType<typeof getScanNeighbours>>
  try {
    summary = await getScanNeighbours(userId, scanId)
  } catch {
    summary = { status: 'unavailable' }
  }

  if (summary.status === 'not_found') return null

  return (
    <section className="card space-y-2" aria-live="polite">
      <h2 className="text-sm font-semibold text-silver-700">Similar confirmed scans</h2>

      {summary.status === 'unavailable' && (
        <p className="text-xs text-silver-600">Similarity lookup is temporarily unavailable.</p>
      )}

      {summary.status === 'not_indexed' && (
        <p className="text-xs text-silver-600">
          This scan has not been added to the similarity index yet. Confirming the verdict with the
          feedback buttons adds it.
        </p>
      )}

      {summary.status === 'ok' && summary.neighbours === 0 && (
        <p className="text-xs text-silver-600">No closely matching confirmed scans found.</p>
      )}

      {summary.status === 'ok' && summary.neighbours > 0 && (
        <>
          <p className="text-2xl font-semibold text-silver-700">
            {Math.round(summary.ai_ratio * 100)}%
            <span className="ml-2 text-xs font-normal text-silver-600">
              of {summary.neighbours} similar confirmed scans were AI-generated
            </span>
          </p>
          <p className="text-xs text-silver-600">
            {summary.ai} AI · {summary.human} human · average similarity {Math.round(summary.avg_similarity * 100)}%
          </p>
        </>
      )}
    </section>
  )
}
