/**
 * Server Component (async). Fetches the signed-in user's recent image scans and verdict
 * mix straight from the server-side data layer -- no /api round trip, no client fetch,
 * no service-role key near the browser. Rendered behind <Suspense> in page.tsx so the
 * uploader paints immediately and this panel streams in.
 */
import Link from 'next/link'
import { getImageVerdictMix, getRecentImageScans } from '@/lib/server/scan-queries'
import { formatConfidence, formatRelativeTime } from '@/lib/utils/helpers'
import { VerdictMixBar } from './VerdictMixBar'

const VERDICT_DOT: Record<string, string> = {
  AI:        'bg-red-400',
  HUMAN:     'bg-emerald-400',
  UNCERTAIN: 'bg-amber-400',
}

export async function RecentImageScans({ userId }: { userId: string }) {
  let scans: Awaited<ReturnType<typeof getRecentImageScans>>
  let mix:   Awaited<ReturnType<typeof getImageVerdictMix>>

  try {
    ;[scans, mix] = await Promise.all([getRecentImageScans(userId, 5), getImageVerdictMix(userId)])
  } catch {
    return (
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-silver-700">Recent image scans</h2>
        <p className="text-xs text-silver-600">Recent scans are temporarily unavailable.</p>
      </section>
    )
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-silver-700">Recent image scans</h2>
        <Link href="/history" className="text-xs text-accent hover:underline">View all</Link>
      </div>

      <VerdictMixBar mix={mix} />

      {scans.length === 0 ? (
        <p className="text-xs text-silver-600">Your image scans will appear here.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {scans.map(scan => (
            <li key={scan.id} className="flex items-center gap-3 py-2">
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${VERDICT_DOT[scan.verdict ?? ''] ?? 'bg-silver-300'}`}
                aria-hidden
              />
              <Link
                href={`/detect/image?scan=${scan.id}`}
                className="min-w-0 flex-1 truncate text-sm text-silver-700 hover:text-white transition-colors"
              >
                {scan.file_name ?? 'Untitled image'}
              </Link>
              <span className="flex-shrink-0 text-xs text-silver-600">
                {scan.verdict ?? '—'}
                {scan.confidence_score != null && ` · ${formatConfidence(scan.confidence_score)}`}
              </span>
              <time className="hidden flex-shrink-0 text-xs text-silver-600 sm:block" dateTime={scan.created_at}>
                {formatRelativeTime(scan.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
