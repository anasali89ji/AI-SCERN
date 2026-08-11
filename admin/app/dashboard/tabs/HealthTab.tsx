'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/api-client'
import { ShimmerBlock } from '../components/ShimmerBlock'
import { CheckCircle, XCircle, AlertTriangle, Activity, Server, Database, Shield } from 'lucide-react'

export default function HealthTab() {
  const { data, error, isLoading } = useSWR('/api/health', fetcher, { refreshInterval: 30000 })

  if (isLoading) return <ShimmerBlock />
  if (error) return <div className="p-6 text-red-400">Failed to load health data</div>
  if (!data) return <div className="p-6 text-slate-400">No health data available</div>

  const overall = data.overall || 'unknown'
  const checks = data.checks || []
  const recentErrors = data.recent_errors_1h || 0

  const statusColors: Record<string, string> = {
    healthy: 'text-green-400 bg-green-400/10',
    degraded: 'text-amber-400 bg-amber-400/10',
    unhealthy: 'text-red-400 bg-red-400/10',
  }

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${statusColors[overall] || 'text-slate-400 bg-slate-400/10'} border-current`}>
        <div className="flex items-center gap-3">
          {overall === 'healthy' ? <CheckCircle size={24} /> : overall === 'degraded' ? <AlertTriangle size={24} /> : <XCircle size={24} />}
          <div>
            <h2 className="text-xl font-bold capitalize">{overall}</h2>
            <p className="text-sm opacity-80">System Status</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><Server size={16} /> Uptime</div>
          <div className="text-2xl font-bold text-slate-100">{Math.floor((data.uptime_seconds || 0) / 3600)}h</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><Shield size={16} /> Version</div>
          <div className="text-2xl font-bold text-slate-100">{data.version || 'N/A'}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><Database size={16} /> Errors (1h)</div>
          <div className="text-2xl font-bold text-slate-100">{recentErrors}</div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-slate-400">
            <tr><th className="text-left p-4">Service</th><th className="text-left p-4">Status</th><th className="text-left p-4">Latency</th><th className="text-left p-4">Message</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {checks.map((check: any, i: number) => (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="p-4 text-slate-200">{check.name}</td>
                <td className="p-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[check.status] || ''}`}>{check.status}</span></td>
                <td className="p-4 text-slate-400">{check.latency_ms}ms</td>
                <td className="p-4 text-slate-400">{check.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
