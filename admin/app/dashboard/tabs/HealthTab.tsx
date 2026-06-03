'use client'
import useSWR from 'swr'
import { Activity, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface HealthCheck {
  name: string; status: 'healthy' | 'degraded' | 'down'; latency_ms?: number
  message?: string; checked_at: string
}
interface HealthData {
  overall: 'healthy' | 'degraded' | 'down'
  checks: HealthCheck[]
  uptime_seconds: number
  version: string
}

const STATUS_ICON = {
  healthy:  <CheckCircle  className="w-4 h-4 text-emerald-400" />,
  degraded: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  down:     <XCircle      className="w-4 h-4 text-rose-400" />,
}
const STATUS_BADGE = {
  healthy:  'badge-active',
  degraded: 'badge-warning',
  down:     'badge-banned',
}
const OVERALL_COLOR = {
  healthy:  'text-emerald-400',
  degraded: 'text-amber-400',
  down:     'text-rose-400',
}

function fmt(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

export default function HealthTab() {
  const { data, isLoading, error, mutate } = useSWR<HealthData>(
    '/health', (p: string) => api<HealthData>(p), { refreshInterval: 30000 }
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Health Monitor
        </h2>
        <button onClick={() => mutate()} aria-label="Refresh health"
          className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-16" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load health data</div>
      ) : (
        <>
          {/* Overall banner */}
          <div className="card flex items-center gap-4">
            <div className="flex-shrink-0">{STATUS_ICON[data?.overall ?? 'healthy']}</div>
            <div className="flex-1">
              <p className={`text-base font-bold ${OVERALL_COLOR[data?.overall ?? 'healthy']}`}>
                System {data?.overall ?? 'unknown'}
              </p>
              <div className="flex items-center gap-4 text-xs text-text-muted mt-0.5">
                {data?.uptime_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Uptime: {fmt(data.uptime_seconds)}
                  </span>
                )}
                {data?.version && <span>v{data.version}</span>}
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className="w-3 h-3 rounded-full live-dot inline-block"
                style={{ background: data?.overall === 'healthy' ? '#34d399' : data?.overall === 'degraded' ? '#fbbf24' : '#f87171' }} />
            </div>
          </div>

          {/* Individual checks */}
          <div className="space-y-2">
            {(data?.checks ?? []).map(check => (
              <div key={check.name} className="card flex items-center gap-4 py-3 px-4">
                <div className="flex-shrink-0">{STATUS_ICON[check.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-text-primary">{check.name}</p>
                    <span className={`badge ${STATUS_BADGE[check.status]}`}>{check.status}</span>
                  </div>
                  {check.message && <p className="text-xs text-text-muted">{check.message}</p>}
                  <p className="text-[10px] text-text-disabled mt-0.5">
                    Checked {new Date(check.checked_at).toLocaleTimeString()}
                  </p>
                </div>
                {check.latency_ms !== undefined && (
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-bold tabular-nums ${check.latency_ms < 100 ? 'text-emerald-400' : check.latency_ms < 500 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {check.latency_ms}ms
                    </p>
                    <p className="text-[10px] text-text-disabled">latency</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
