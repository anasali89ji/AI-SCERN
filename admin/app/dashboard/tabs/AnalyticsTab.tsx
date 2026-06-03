'use client'
import useSWR from 'swr'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

const fetcher = (p: string) => api<Record<string, unknown>>(p)

export default function AnalyticsTab() {
  const { data, isLoading, error, mutate } = useSWR('/analytics?period=30d', fetcher)
  const d = (data ?? {}) as Record<string, unknown>

  if (isLoading) return <div className="grid grid-cols-2 gap-4">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} h="h-64" />)}</div>
  if (error) return (
    <div className="text-center py-16">
      <p className="text-sm text-rose-400 mb-3">Failed to load analytics</p>
      <button onClick={() => mutate()} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary mx-auto transition-colors">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-text-primary">Analytics — Last 30 days</h2>
        </div>
        <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">Scan Volume (30d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={(d.dailyScans as unknown[]) ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="ai"    stroke="#f87171" strokeWidth={1.5} dot={false} name="AI" />
              <Line type="monotone" dataKey="human" stroke="#34d399" strokeWidth={1.5} dot={false} name="Human" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">New Users (30d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(d.dailyUsers as unknown[]) ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
              <Bar dataKey="new_users" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
