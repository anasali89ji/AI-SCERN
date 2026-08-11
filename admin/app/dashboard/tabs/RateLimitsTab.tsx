'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Gauge, RefreshCw, Shield, Ban, Clock } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface RateLimitEvent {
  ip_address: string; endpoint: string; count: number; last_at: string
}

export default function RateLimitsTab() {
  const [period, setPeriod] = useState('24h')
  const { data, isLoading, error, mutate } = useSWR<{ aggregated: RateLimitEvent[]; total: number }>(
    `/rate-limits?period=${period}`,
    (p: string) => api<{ aggregated: RateLimitEvent[]; total: number }>(p)
  )

  const blockIp = async (ip: string) => {
    if (!confirm(`Block IP ${ip}?`)) return
    try {
      await api('/rate-limits', 'POST', { ip, reason: 'Manual block from admin panel' })
      await mutate()
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Gauge className="w-5 h-5 text-primary" /> Rate Limit Monitor
        </h2>
        <div className="flex items-center gap-2">
          {['1h', '24h', '7d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
              {p === '1h' ? 'Last Hour' : p === '24h' ? 'Last 24h' : 'Last 7 Days'}
            </button>
          ))}
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-text-primary">{data?.total || 0}</p>
          <p className="text-xs text-text-muted">Total Events</p>
        </div>
        <div className="card p-4 text-center">
          <Gauge className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-text-primary">{data?.aggregated?.length || 0}</p>
          <p className="text-xs text-text-muted">Unique IPs</p>
        </div>
        <div className="card p-4 text-center">
          <Ban className="w-6 h-6 text-rose-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-text-primary">{data?.aggregated?.filter((a: any) => a.count > 50).length || 0}</p>
          <p className="text-xs text-text-muted">High Volume</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load rate limits</div>
      ) : (
        <div className="space-y-2">
          {(data?.aggregated ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No rate limit events</div>}
          {(data?.aggregated ?? []).map((item: any) => (
            <div key={item.ip} className="card flex items-center justify-between p-3">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${item.count > 50 ? 'bg-rose-400' : item.count > 20 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <div>
                  <p className="text-sm font-mono text-text-primary">{item.ip}</p>
                  <p className="text-[10px] text-text-muted flex items-center gap-2">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(item.lastAt).toLocaleString()}</span>
                    <span>{item.endpoints?.slice(0, 3).join(', ')}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${item.count > 50 ? 'text-rose-400' : 'text-text-primary'}`}>{item.count} hits</span>
                <button onClick={() => blockIp(item.ip)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-400/10 border border-rose-400/20 hover:bg-rose-400/20">
                  Block
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
