'use client'

import { Check, Minus, X } from 'lucide-react'

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

function AiscernCheck() {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/10">
      <Check className="w-4 h-4 text-accent" strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

function CompetitorCheck() {
  return <Check className="w-[18px] h-[18px] text-emerald-400/80" strokeWidth={2.5} aria-hidden="true" />
}

function Cross() {
  return <X className="w-4 h-4 text-silver-600/50" strokeWidth={2.5} aria-hidden="true" />
}

function Partial() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
      <Minus className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
      partial
    </span>
  )
}

function Cell({ v, highlight }: { v: boolean | string; highlight?: boolean }) {
  if (typeof v === 'string') return <Partial />
  if (v === true) return highlight ? <AiscernCheck /> : <CompetitorCheck />
  return <Cross />
}

export default function ComparisonSection() {
  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-page">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">
            Competitive Edge
          </p>
          <h2 className="font-heading font-bold text-headline text-silver-900 tracking-tight mb-3 sm:mb-4">
            The only platform covering all four media types
          </h2>
          <p className="text-lead text-silver-600 max-w-xl mx-auto">
            Most detectors stop at text. Aiscern covers text, images, audio, and video in one place.
          </p>
        </div>

        {/* ── Mobile: stacked cards ── */}
        <div className="sm:hidden space-y-3">
          {COLS.map(col => (
            <div
              key={col.key}
              className={`rounded-xl p-5 border ${
                col.highlight
                  ? 'ring-1 ring-accent/20 border-accent/25 bg-accent/[0.04]'
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

        {/* ── Tablet & up: table with sticky first column ── */}
        <div className="hidden sm:block overflow-x-auto">
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-surface-elevated border-b border-white/[0.06]">
                  <th className="sticky left-0 z-10 text-left py-3.5 px-4 text-xs font-bold uppercase tracking-[0.08em] text-silver-700 bg-surface-elevated border-r border-white/[0.06] w-48">
                    Feature
                  </th>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      className={`py-3.5 px-4 text-center text-xs font-bold uppercase tracking-[0.08em] ${col.highlight ? 'text-accent bg-accent/[0.05] border-x border-accent/15 border-t-2 border-t-accent' : 'text-silver-700'}`}
                    >
                      <span>{col.label}</span>
                      {col.highlight && (
                        <span className="ml-1.5 text-[10px] font-bold bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 align-middle">
                          Our pick
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr
                    key={row.name}
                    className={`border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] transition-colors duration-150 ${i % 2 === 0 ? 'bg-surface-elevated/40' : ''}`}
                  >
                    <td className="sticky left-0 z-10 py-3.5 px-4 text-sm font-medium text-silver-700 bg-surface border-r border-white/[0.06]">
                      {row.name}
                    </td>
                    {COLS.map(col => (
                      <td
                        key={col.key}
                        className={`py-3.5 px-4 text-center ${col.highlight ? 'bg-accent/[0.05] border-x border-accent/15' : ''}`}
                      >
                        <Cell v={row[col.key]} highlight={col.highlight} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-silver-600 mt-6">
          Capability comparison based on each provider&apos;s publicly documented features. &ldquo;Partial&rdquo; = limited functionality.
        </p>
      </div>
    </section>
  )
}
