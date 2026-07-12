'use client'
import useSWR from 'swr'
import { useState } from 'react'
import { DollarSign, RefreshCw, AlertTriangle, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface FallbackFlag {
  modality: string
  paid_calls: number
  detections: number
  paid_call_rate: number | null
  flagged: boolean
}

interface CostSummaryData {
  window_days: number
  since: string
  totals: Record<string, Record<string, number>>   // vendor -> modality -> count
  daily: Record<string, string | number>[]          // { day, gemini, nvidia_nim, huggingface }
  fallback_flags: FallbackFlag[]
  generated_at: string
}

const VENDOR_LABEL: Record<string, string> = {
  gemini: 'Gemini', nvidia_nim: 'NVIDIA NIM', huggingface: 'HuggingFace',
}
const VENDOR_COLOR: Record<string, string> = {
  gemini: 'text-violet-400', nvidia_nim: 'text-emerald-400', huggingface: 'text-amber-400',
}
const MODALITY_LABEL: Record<string, string> = {
  text: 'Text', image: 'Image', audio: 'Audio', video: 'Video',
}

function pct(n: number | null): string {
  if (n === null) return '—'
  return `${Math.round(n * 100)}%`
}

export default function PipelineCostSummaryTab() {
  const [windowDays, setWindowDays] = useState(7)
  const { data, isLoading, error, mutate } = useSWR<CostSummaryData>(
    `/pipeline-cost-summary?days=${windowDays}`,
    (p: string) => api<CostSummaryData>(p),
    { refreshInterval: 60000 }
  )

  const vendors = Object.keys(data?.totals ?? {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Pipeline Cost Summary
        </h2>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setWindowDays(d)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                windowDays === d
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-surface border-border text-text-muted hover:text-text-primary'
              }`}>
              {d}d
            </button>
          ))}
          <button onClick={() => mutate()} aria-label="Refresh cost summary"
            className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        MODULE 6 — measures the actual reduction in paid-vendor calls from the
        self-hosted-first modules (1–4), rather than assuming it. Counts come
        from <code className="text-text-disabled">vendor_call_log</code>,
        written at each Gemini / NVIDIA NIM / HF Inference API call site.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <ShimmerCard key={i} h="h-24" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load cost summary</div>
      ) : (
        <>
          {/* Per-vendor totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vendors.map(vendor => {
              const modalityTotals = data!.totals[vendor]
              const total = Object.values(modalityTotals).reduce((a, b) => a + b, 0)
              return (
                <div key={vendor} className="card">
                  <p className={`text-xs font-semibold ${VENDOR_COLOR[vendor] ?? 'text-text-primary'}`}>
                    {VENDOR_LABEL[vendor] ?? vendor}
                  </p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">
                    {total.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-disabled">calls, last {windowDays}d</p>
                  <div className="mt-2 space-y-0.5">
                    {Object.entries(modalityTotals).map(([modality, count]) => (
                      count > 0 && (
                        <div key={modality} className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">{MODALITY_LABEL[modality] ?? modality}</span>
                          <span className="text-text-primary tabular-nums">{count.toLocaleString()}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Fallback rate flags — task 3: >40% paid-fallback rate is a calibration signal */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-primary" /> Paid-Call Rate by Modality
            </p>
            {(data?.fallback_flags ?? []).map(f => (
              <div key={f.modality}
                className={`card flex items-center justify-between py-3 px-4 ${f.flagged ? 'border-amber-500/40' : ''}`}>
                <div className="flex items-center gap-3">
                  {f.flagged && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{MODALITY_LABEL[f.modality] ?? f.modality}</p>
                    <p className="text-[11px] text-text-muted">
                      {f.paid_calls.toLocaleString()} paid calls / {f.detections.toLocaleString()} detections
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold tabular-nums ${f.flagged ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {pct(f.paid_call_rate)}
                  </p>
                  {f.flagged && (
                    <p className="text-[10px] text-amber-400">exceeds 40% — revisit calibration</p>
                  )}
                </div>
              </div>
            ))}
            {(data?.fallback_flags ?? []).length === 0 && (
              <p className="text-xs text-text-disabled py-4 text-center">No detection volume in this window yet.</p>
            )}
          </div>

          <p className="text-[10px] text-text-disabled">
            Generated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}
          </p>
        </>
      )}
    </div>
  )
}
