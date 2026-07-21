'use client'
import useSWR from 'swr'
import { HeartPulse, RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function HealthTab() {
  const { data, isLoading, error, mutate } = useSWR('/health', (p: string) => api(p))
  const d = data as any

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load health data</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  const overallColor = d?.overall === 'healthy' ? 'text-emerald-400' : d?.overall === 'degraded' ? 'text-amber-400' : 'text-rose-400'
  const overallIcon = d?.overall === 'healthy' ? CheckCircle : d?.overall === 'degraded' ? AlertTriangle : XCircle

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><HeartPulse className="w-5 h-5 text-primary" /> Health Monitor</h2>
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="card p-6 text-center">
        <overallIcon className={`w-12 h-12 mx-auto mb-2 ${overallColor}`} />
        <p className={`text-2xl font-bold ${overallColor}`}>{d?.overall?.toUpperCase()}</p>
        <p className="text-xs text-text-muted mt-1">Uptime: {Math.floor((d?.uptime_seconds ?? 0) / 3600)}h {Math.floor(((d?.uptime_seconds ?? 0) % 3600) / 60)}m</p>
        <p className="text-xs text-text-muted">Version: {d?.version}</p>
        <p className="text-xs text-text-muted">Recent Errors (1h): {d?.recent_errors_1h ?? 0}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(d?.checks ?? []).map((check: any) => (
          <div key={check.name} className="card p-4 flex items-center gap-3">
            {check.status === 'healthy' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : check.status === 'degraded' ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">{check.name}</p>
              <p className="text-xs text-text-muted">{check.status === 'healthy' ? `${check.latency_ms}ms` : check.message}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${check.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : check.status === 'degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{check.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
