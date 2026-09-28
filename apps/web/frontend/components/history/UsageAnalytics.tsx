'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Scan, Percent, Clock, Download, Loader2, AlertCircle } from 'lucide-react'

interface CustomerSummary {
  total_scans: number
  active_days: number
  avg_confidence: number | null
  avg_processing_time_ms: number | null
  ai_detections: number
  human_detections: number
  uncertain_detections: number
}

interface DailyTrendRow {
  day: string
  scans: number
  avg_confidence: number | null
}

export function UsageAnalytics() {
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [trend, setTrend] = useState<DailyTrendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveAvailable, setArchiveAvailable] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics/customer?days=30')
        if (res.ok) {
          const json = await res.json()
          setSummary(json.summary)
          setTrend(json.dailyTrend ?? [])
          setArchiveAvailable(json.archiveAvailable !== false)
        }
      } catch { /* fall through to empty state below */ }
      setLoading(false)
    })()
  }, [])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/analytics/customer/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `aiscern-scan-history-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { /* silent — button just stops spinning, no scan-affecting failure */ }
    setExporting(false)
  }

  const favoriteVerdict = summary
    ? (['ai_detections', 'human_detections', 'uncertain_detections'] as const)
        .reduce((max, k) => (summary[k] > summary[max] ? k : max), 'ai_detections' as const)
    : null
  const favoriteLabel = favoriteVerdict === 'ai_detections' ? 'AI-flagged'
    : favoriteVerdict === 'human_detections' ? 'Human-verified' : 'Uncertain'

  if (loading) {
    return <div className="card flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
  }

  if (!archiveAvailable || !summary) {
    return (
      <div className="card flex items-start gap-3 py-6">
        <AlertCircle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-text-primary">Usage analytics aren't available yet</p>
          <p className="text-xs text-text-muted mt-1">
            This fills in once your scans have been archived (usually within minutes of scanning) and the archive is reachable.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4">
          <div className="flex items-center gap-2 text-text-muted text-xs mb-1"><Scan className="w-3.5 h-3.5" /> Scans (30d)</div>
          <div className="text-xl font-black text-text-primary">{summary.total_scans.toLocaleString()}</div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-2 text-text-muted text-xs mb-1"><Percent className="w-3.5 h-3.5" /> Avg Confidence</div>
          <div className="text-xl font-black text-text-primary">
            {summary.avg_confidence != null ? `${Math.round(summary.avg_confidence * 100)}%` : 'N/A'}
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-2 text-text-muted text-xs mb-1"><Clock className="w-3.5 h-3.5" /> Avg Time</div>
          <div className="text-xl font-black text-text-primary">
            {summary.avg_processing_time_ms != null ? `${Math.round(summary.avg_processing_time_ms)}ms` : 'N/A'}
          </div>
        </div>
        <div className="card py-4">
          <div className="text-text-muted text-xs mb-1">Most Common Result</div>
          <div className="text-xl font-black text-text-primary">{favoriteLabel}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-text-primary">Scans Over Time (30 Days)</h3>
          <button onClick={exportCsv} disabled={exporting} className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-60">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'Exporting…' : 'Export Full History (CSV)'}
          </button>
        </div>
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="scans" stroke="#0ea5e9" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-text-muted py-12 text-center">No scans in the last 30 days.</p>
        )}
      </div>

      <p className="text-xs text-text-muted">
        "Export Full History" pulls your complete archived scan history — including scans older than your
        account's retention window — not just the last 30 days shown above.
      </p>
    </div>
  )
}
