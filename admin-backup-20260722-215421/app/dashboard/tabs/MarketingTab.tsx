'use client'
import useSWR from 'swr'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function MarketingTab() {
  const { data, isLoading, error, mutate } = useSWR('/marketing', (p: string) => api(p))
  const d = data as any

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load marketing data</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Marketing Analytics</h2>
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ label: 'Total Visits', value: d?.kpis?.total_visits ?? 0 }, { label: 'Unique Visitors', value: d?.kpis?.unique_visitors ?? 0 }, { label: 'Signups', value: d?.kpis?.signups ?? 0 }, { label: 'Conversion', value: `${(d?.kpis?.conversion_rate ?? 0).toFixed(1)}%` }].map(k => (
          <div key={k.label} className="card p-4"><p className="text-xl font-bold text-text-primary">{k.value.toLocaleString()}</p><p className="text-[11px] text-text-muted">{k.label}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Traffic Daily</h3>
          <ResponsiveContainer width="100%" height={200}><BarChart data={d?.traffic_daily ?? []}><XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="visits" fill="#3b82f6" radius={[4,4,0,0]} /><Bar dataKey="signups" fill="#10b981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
        </div>
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Device Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={d?.device_breakdown ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
            {(d?.device_breakdown ?? []).map((_: any, i: number) => <Cell key={i} fill={['#3b82f6', '#10b981', '#f59e0b'][i]} />)}
          </Pie><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /></PieChart></ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
