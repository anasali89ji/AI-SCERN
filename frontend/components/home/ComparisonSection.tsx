'use client'

import { Check, Minus, X } from 'lucide-react'

// NOTE: Rebuilt from the old, unused ComparisonTable.tsx. Dropped its
// "85%+ text accuracy" / "$10/mo" style rows — those were unverifiable
// competitor numbers, and the 85%+ figure directly contradicted this
// site's own ~94% text-accuracy claim elsewhere. Kept only capability
// facts that are public knowledge (these tools being text-only).
const FEATURES: { name: string; aiscern: boolean | string; gptzero: boolean | string; turnitin: boolean | string; originality: boolean | string }[] = [
  { name: 'Text AI detection',         aiscern: true, gptzero: true,  turnitin: true,      originality: true  },
  { name: 'Image deepfake detection',  aiscern: true, gptzero: false, turnitin: false,     originality: false },
  { name: 'Audio AI detection',        aiscern: true, gptzero: false, turnitin: false,     originality: false },
  { name: 'Video deepfake detection',  aiscern: true, gptzero: false, turnitin: false,     originality: false },
  { name: 'Batch / bulk analysis',     aiscern: true, gptzero: false, turnitin: 'partial', originality: false },
  { name: 'Sentence-level heatmap',    aiscern: true, gptzero: true,  turnitin: false,     originality: true  },
  { name: 'API access',                aiscern: true, gptzero: true,  turnitin: true,      originality: true  },
  { name: 'Free tier available',       aiscern: true, gptzero: true,  turnitin: false,     originality: false },
]

const COLS = [
  { key: 'aiscern' as const,     label: 'Aiscern',     highlight: true  },
  { key: 'gptzero' as const,     label: 'GPTZero',     highlight: false },
  { key: 'turnitin' as const,    label: 'Turnitin',    highlight: false },
  { key: 'originality' as const, label: 'Originality', highlight: false },
]

function Cell({ v, highlight }: { v: boolean | string; highlight?: boolean }) {
  if (typeof v === 'string') return <span className="text-xs font-medium text-amber-400">{v}</span>
  if (v === true)  return <Check className={`w-4 h-4 mx-auto ${highlight ? 'text-accent' : 'text-emerald-400/70'}`} aria-hidden="true" />
  return <X className="w-3.5 h-3.5 mx-auto text-silver-600/40" aria-hidden="true" />
}

export default function ComparisonSection() {
  return (
    <section className="py-14 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-silver-600 mb-2.5 sm:mb-3">
            Competitive Edge
          </p>
          <h2 className="text-headline text-silver-900 mb-3">
            The only platform covering all four media types
          </h2>
          <p className="text-silver-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Most detectors stop at text. Aiscern covers text, images, audio, and video in one place.
          </p>
        </div>

        {/* ── Mobile (<640px): stacked feature cards, one per competitor ──
            A comparison table needs 5 columns of width to breathe; forcing
            that into a phone means either illegible tiny type or a
            horizontal-scroll table cropped at the edge — neither reads as
            "beautiful." Cards let each competitor's row of checks/crosses
            wrap naturally and stay legible at any width. */}
        <div className="sm:hidden space-y-3">
          {COLS.map(col => (
            <div
              key={col.key}
              className={`rounded-xl p-5 border ${
                col.highlight
                  ? 'border-accent/25 bg-accent/[0.04]'
                  : 'border-white/[0.06] bg-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-semibold ${col.highlight ? 'text-accent' : 'text-silver-900'}`}>
                  {col.label}
                </span>
                {col.highlight && (
                  <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                    Our pick
                  </span>
                )}
              </div>
              <ul className="space-y-2.5">
                {FEATURES.map(row => (
                  <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-silver-600">{row.name}</span>
                    <Cell v={row[col.key]} highlight={col.highlight} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Tablet & up: table ── */}
        <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-silver-600 text-sm font-medium w-48">Feature</th>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className={`p-4 text-center ${col.highlight ? 'bg-accent/[0.06] border-x border-accent/15' : ''}`}
                  >
                    <span className={`text-sm font-bold ${col.highlight ? 'text-accent' : 'text-silver-700'}`}>
                      {col.label}
                    </span>
                    {col.highlight && <div className="text-[11px] text-accent/70 font-normal mt-0.5">Our pick</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr key={row.name} className={`border-b border-white/[0.06] last:border-0 ${i % 2 === 0 ? 'bg-surface-elevated/40' : ''}`}>
                  <td className="p-4 text-sm text-silver-600">{row.name}</td>
                  {COLS.map(col => (
                    <td
                      key={col.key}
                      className={`p-4 text-center ${col.highlight ? 'bg-accent/[0.03] border-x border-accent/10' : ''}`}
                    >
                      <Cell v={row[col.key]} highlight={col.highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-silver-600 mt-6">
          Capability comparison based on each provider&apos;s publicly documented features. &ldquo;Partial&rdquo; = limited functionality.
        </p>
      </div>
    </section>
  )
}
