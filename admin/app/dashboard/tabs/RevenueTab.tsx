'use client'
import useSWR from 'swr'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Receipt, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function RevenueTab() {
  const { data, isLoading, error, mutate } = useSWR('/revenue', (p: string) => api(p))
  const d = data as any

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load revenue data</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" /> Revenue</h2>
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ label: 'MRR', value: `$${(d?.kpis?.mrr ?? 0).toLocaleString()}` }, { label: 'ARR', value: `$${(d?.kpis?.arr ?? 0).toLocaleString()}` }, { label: 'Churn Rate', value: `${d?.kpis?.churn_rate ?? 0}%` }, { label: 'ARPU', value: `$${(d?.kpis?.avg_revenue_per_user ?? 0).toFixed(2)}` }].map(k => (
          <div key={k.label} className="card p-4"><p className="text-xl font-bold text-text-primary">{k.value}</p><p className="text-[11px] text-text-muted">{k.label}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">MRR Trend</h3>
          <ResponsiveContainer width="100%" height={220}><AreaChart data={d?.mrr_trend ?? []}><defs><linearGradient id="mrrG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="month" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={40} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Area type="monotone" dataKey="mrr" stroke="#3b82f6" fill="url(#mrrG)" strokeWidth={2} /></AreaChart></ResponsiveContainer>
        </div>
        <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Revenue by Plan</h3>
          <ResponsiveContainer width="100%" height={220}><BarChart data={d?.by_plan ?? []}><XAxis dataKey="plan" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={40} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
        </div>
      </div>
      <div className="card p-4"><h3 className="text-sm font-bold text-text-primary mb-4">Revenue Forecast</h3>
        <ResponsiveContainer width="100%" height={180}><AreaChart data={d?.forecast ?? []}><XAxis dataKey="month" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={50} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Area type="monotone" dataKey="mrr" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" /></AreaChart></ResponsiveContainer>
      </div>
    </div>
  )
}
