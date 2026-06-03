'use client'
import useSWR from 'swr'
import { Play, RefreshCw, Database, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface PipelineJob {
  id: string; name: string; status: string; last_run?: string; duration_ms?: number; error?: string
}
interface PipelineData { jobs: PipelineJob[]; queue_depth: number; workers_active: number }

export default function PipelineTab() {
  const { data, isLoading, error, mutate } = useSWR<PipelineData>('/pipeline', (p: string) => api<PipelineData>(p), { refreshInterval: 30000 })

  const triggerJob = async (id: string) => {
    try { await api(`/pipeline`, 'POST', { job_id: id }); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const STATUS_ICON: Record<string, React.ReactNode> = {
    running:  <Clock    className="w-4 h-4 text-amber-400 spinner" />,
    success:  <CheckCircle className="w-4 h-4 text-emerald-400" />,
    failed:   <AlertTriangle className="w-4 h-4 text-rose-400" />,
    idle:     <Database  className="w-4 h-4 text-text-disabled" />,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" /> Pipeline
        </h2>
        <button onClick={() => mutate()} aria-label="Refresh pipeline" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled mb-1">Queue Depth</p>
            <p className="text-3xl font-black text-primary tabular-nums">{data.queue_depth}</p>
          </div>
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled mb-1">Workers Active</p>
            <p className="text-3xl font-black text-emerald-400 tabular-nums">{data.workers_active}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} h="h-16" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load pipeline data</div>
      ) : (
        <div className="space-y-2">
          {(data?.jobs ?? []).map(job => (
            <div key={job.id} className="card flex items-center gap-4 py-3 px-4">
              <div className="flex-shrink-0">{STATUS_ICON[job.status] ?? STATUS_ICON.idle}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{job.name}</p>
                <div className="flex items-center gap-3 text-[11px] text-text-disabled mt-0.5">
                  {job.last_run && <span>Last: {new Date(job.last_run).toLocaleString()}</span>}
                  {job.duration_ms && <span>{(job.duration_ms / 1000).toFixed(1)}s</span>}
                  {job.error && <span className="text-rose-400 truncate">{job.error}</span>}
                </div>
              </div>
              <button onClick={() => triggerJob(job.id)} aria-label={`Run ${job.name}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors">
                <Play className="w-3 h-3" /> Run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
