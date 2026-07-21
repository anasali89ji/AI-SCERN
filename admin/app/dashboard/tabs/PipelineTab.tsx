'use client'
import useSWR from 'swr'
import { GitBranch, RefreshCw, Database, Server } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function PipelineTab() {
  const { data, isLoading, error, mutate } = useSWR('/pipeline', (p: string) => api(p))
  const d = data as any

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load pipeline data</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><GitBranch className="w-5 h-5 text-primary" /> Pipeline Monitor</h2>
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ label: 'Total Scraped', value: d?.pipeline?.total_scraped ?? 0, icon: Database }, { label: 'Total Pushed', value: d?.pipeline?.total_pushed ?? 0, icon: Database }, { label: 'Buffer Total', value: d?.d1_buffer?.total ?? 0, icon: Database }, { label: 'Pending', value: d?.d1_buffer?.pending ?? 0, icon: Server }].map(k => (
          <div key={k.label} className="card p-4"><k.icon className="w-5 h-5 text-primary mb-2" /><p className="text-xl font-bold text-text-primary">{k.value.toLocaleString()}</p><p className="text-[11px] text-text-muted">{k.label}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Worker Stats</h3>
          <div className="space-y-2">{(d?.worker_stats ?? []).map((w: any) => (
            <div key={w.worker_id} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
              <span className="text-xs text-text-primary font-mono">{w.worker_id}</span>
              <div className="flex items-center gap-4 text-xs text-text-muted"><span>{w.items} items</span><span>Q: {w.avg_q}</span></div>
            </div>
          ))}</div>
        </div>
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Recent Pushes</h3>
          <div className="space-y-2">{(d?.recent_pushes ?? []).map((p: any) => (
            <div key={p.commit_id || p.created_at} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
              <span className="text-xs text-text-primary font-mono truncate max-w-[200px]">{p.commit_id?.slice(0, 12) || '—'}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${p.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{p.status}</span>
            </div>
          ))}</div>
        </div>
      </div>
    </div>
  )
}
