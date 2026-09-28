'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { BarChart3, RefreshCw, Globe } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function AnalyticsTab() {
  const [period, setPeriod] = useState('7d')
  const { data, isLoading, error, mutate } = useSWR(`/analytics?period=${period}`, (p: string) => api(p))
  const d = data as any

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load analytics</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Detailed Analytics</h2>
        <div className="flex items-center gap-2">
          {['7d', '30d', '90d'].map(p => <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-primary text-white' : 'bg-surface text-text-muted border border-border'}`}>{p}</button>)}
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Notification Types</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={d?.notificationTypes ?? []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
              {(d?.notificationTypes ?? []).map((_: any, i: number) => <Cell key={i} fill={['#3b82f6', '#f59e0b', '#10b981', '#f87171', '#a78bfa'][i % 5]} />)}
            </Pie><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Top Countries</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d?.countryDistribution ?? []} layout="vertical"><XAxis type="number" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis dataKey="country" type="category" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={60} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="count" fill="#3b82f6" radius={[0,4,4,0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
