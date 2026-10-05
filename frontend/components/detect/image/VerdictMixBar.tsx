'use client'
/**
 * Client leaf: interactive verdict-mix bar.
 *
 * The data is fetched and cached on the server (see lib/server/scan-queries.ts) and passed
 * in as plain serialisable props -- this component owns only hover state, so it is the only
 * piece of the "recent scans" panel that ships JavaScript.
 */
import { useState } from 'react'
import type { VerdictMix } from '@/lib/server/scan-queries'

type Key = 'ai' | 'human' | 'uncertain'

const SEGMENTS: ReadonlyArray<{ key: Key; label: string; bar: string; dot: string }> = [
  { key: 'ai',        label: 'AI',        bar: 'bg-red-400/80',     dot: 'bg-red-400' },
  { key: 'human',     label: 'Human',     bar: 'bg-emerald-400/80', dot: 'bg-emerald-400' },
  { key: 'uncertain', label: 'Uncertain', bar: 'bg-amber-400/80',   dot: 'bg-amber-400' },
]

export function VerdictMixBar({ mix }: { mix: VerdictMix }) {
  const [active, setActive] = useState<Key | null>(null)

  if (mix.total === 0) {
    return <p className="text-xs text-silver-600">No image scans in the last 30 days.</p>
  }

  const activeSeg = SEGMENTS.find(s => s.key === active)

  return (
    <div className="space-y-2">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]"
        role="img"
        aria-label={`Last 30 days: ${mix.ai} AI, ${mix.human} human, ${mix.uncertain} uncertain`}
      >
        {SEGMENTS.map(seg => {
          const n = mix[seg.key]
          if (n === 0) return null
          return (
            <div
              key={seg.key}
              className={`${seg.bar} transition-opacity ${active && active !== seg.key ? 'opacity-40' : ''}`}
              style={{ width: `${(n / mix.total) * 100}%` }}
              onMouseEnter={() => setActive(seg.key)}
              onMouseLeave={() => setActive(null)}
            />
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-600">
        {SEGMENTS.map(seg => (
          <li
            key={seg.key}
            className="flex items-center gap-1.5"
            onMouseEnter={() => setActive(seg.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className={`h-2 w-2 rounded-full ${seg.dot}`} />
            {seg.label} <span className="text-silver-700 font-medium">{mix[seg.key]}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-silver-600 min-h-[1rem]" aria-live="polite">
        {activeSeg
          ? `${Math.round((mix[activeSeg.key] / mix.total) * 100)}% of ${mix.total} scans were ${activeSeg.label.toLowerCase()}`
          : `${mix.total} scans in the last 30 days`}
      </p>
    </div>
  )
}
