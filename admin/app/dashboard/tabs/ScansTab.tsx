'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { ScanLine, RefreshCw, Download, Filter, Image, FileText, Music, Video } from 'lucide-react'
import DataTable from '../components/DataTable'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Scan {
  id: string; user_id: string; profiles?: { email: string; display_name: string }
  media_type: string; verdict: string; confidence_score: number; created_at: string
}

const MEDIA_ICONS: Record<string, any> = { text: FileText, image: Image, audio: Music, video: Video }
const VERDICT_COLORS: Record<string, string> = {
  AI: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  HUMAN: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  UNCERTAIN: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

export default function ScansTab() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState('all')
  const [verdict, setVerdict] = useState('all')

  const typeParam = type !== 'all' ? `&type=${type}` : ''
  const verdictParam = verdict !== 'all' ? `&verdict=${verdict}` : ''
  const { data, isLoading, error, mutate } = useSWR<{ scans: Scan[]; total: number; pages: number }>(
    `/scans?page=${page}${typeParam}${verdictParam}`,
    (p: string) => api(p)
  )

  const exportScans = async () => {
    const res = await fetch(`/api/scans/export?format=csv${typeParam}${verdictParam}`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scans_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const columns = [
    {
      key: 'user', header: 'User',
      render: (s: Scan) => (
        <div>
          <p className="text-text-primary text-xs font-medium">{s.profiles?.email || s.user_id?.slice(0,8)}</p>
          <p className="text-[10px] text-text-disabled">{s.profiles?.display_name || '—'}</p>
        </div>
      )
    },
    {
      key: 'media_type', header: 'Type',
      render: (s: Scan) => {
        const Icon = MEDIA_ICONS[s.media_type] || ScanLine
        return <span className="flex items-center gap-1 text-xs text-text-muted"><Icon className="w-3.5 h-3.5"/> {s.media_type}</span>
      }
    },
    {
      key: 'verdict', header: 'Verdict',
      render: (s: Scan) => (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${VERDICT_COLORS[s.verdict] || 'text-text-muted'}`}>
          {s.verdict}
        </span>
      )
    },
    {
      key: 'confidence', header: 'Confidence',
      render: (s: Scan) => (
        <div className="w-24">
          <div className="h-1.5 rounded-full bg-surface border border-border overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((s.confidence_score || 0) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-text-muted">{Math.round((s.confidence_score || 0) * 100)}%</span>
        </div>
      )
    },
    {
      key: 'created_at', header: 'Time',
      render: (s: Scan) => <span className="text-xs text-text-muted">{new Date(s.created_at).toLocaleString()}</span>
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-primary" /> Live Scan Monitor
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={type} onChange={e => { setType(e.target.value); setPage(1) }}
            className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-secondary">
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
          <select value={verdict} onChange={e => { setVerdict(e.target.value); setPage(1) }}
            className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-secondary">
            <option value="all">All Verdicts</option>
            <option value="AI">AI</option>
            <option value="HUMAN">Human</option>
            <option value="UNCERTAIN">Uncertain</option>
          </select>
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportScans}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary bg-surface border border-border hover:bg-surface/80">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load scans</div>
      ) : isLoading ? (
        <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
      ) : (
        <DataTable columns={columns} data={data?.scans ?? []} keyFn={s => s.id}
          page={page} totalPages={data?.pages} onPage={setPage} caption="Scans table" emptyMessage="No scans found" />
      )}
    </div>
  )
}
