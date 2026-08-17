'use client'

import { useEffect, useState } from 'react'
import { CountUp } from '@/components/home/CountUp'

/**
 * Renders the "Benchmarked Datasets" stat. Deliberately kept as a small
 * client island (not moved to a server fetch in page.tsx): the homepage is
 * statically prerendered, and a server-side fetch here would either force
 * the whole page to `dynamic = 'force-dynamic'` (adds TTFB) or bake the
 * count in until the next deploy. This preserves the original live-update
 * behavior while staying off the LCP path (fetch fires after mount).
 */
export function DatasetStatValue({
  fallbackVal, fallbackSuffix, fallbackLabel,
}: {
  fallbackVal: string
  fallbackSuffix: string
  fallbackLabel: string
}) {
  const [rows, setRows] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/dataset-stats')
      .then(r => r.json())
      .then(d => { if (d.rows) setRows(d.rows) })
      .catch(() => {})
  }, [])

  const live = rows
    ? rows >= 1_000_000
      ? { val: Math.round(rows / 100_000) / 10, suffix: 'M+', label: 'training samples' }
      : rows >= 1000
      ? { val: Math.round(rows / 1000), suffix: 'k+', label: 'training samples' }
      : { val: rows, suffix: '+', label: 'training samples' }
    : null

  const displayStat   = live ? String(live.val) : fallbackVal
  const displaySuffix = live ? live.suffix : fallbackSuffix
  const displayLabel  = live ? live.label : fallbackLabel
  const displayTarget = parseFloat(displayStat) || 0

  return (
    <div className="mb-3">
      <div className="text-3xl sm:text-4xl font-black tabular-nums"
        style={{ background: 'linear-gradient(135deg, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        <CountUp target={displayTarget} suffix={displaySuffix} />
      </div>
      <div className="text-xs text-text-muted font-medium">{displayLabel}</div>
    </div>
  )
}
