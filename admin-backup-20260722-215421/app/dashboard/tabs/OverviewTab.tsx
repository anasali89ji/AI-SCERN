'use client'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Activity, Users, Radio, Clock, Crown, Ban, Star, Zap, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import { ShimmerCard } from '../components/ShimmerBlock'
import { api } from '@/lib/api-client'

const fetcher = (path: string) => api<Record<string, unknown>>(path)
const PLAN_COLORS: Record<string, string> = { free: '#64748b', pro: '#2563eb', team: '#06b6d4', enterprise: '#f59e0b' }
const VERDICT_COLORS: Record<string, string> = { AI: '#f87171', HUMAN: '#34d399', UNCERTAIN: '#fbbf24' }

export default function OverviewTab() {
  const [period, setPeriod] = useState('7d')
  const { data, error, isLoading, mutate } = useSWR<Record<string, unknown>>(`/analytics?period=${period}`, fetcher, { refreshInterval: 30000 })
  const k = (data as any)?.kpis ?? {}

  if (error) return <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-sm text-rose-400 mb-3">Failed to load analytics</p><button onClick={() => mutate()} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /> Retry</button></div>
  if (isLoading) return <div className="space-y-5"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div></div>

  const d = data as any
  const scansTrend = ((d?.dailyScans as any[])?.at(-1)?.total || 0) > (((d?.dailyScans as any[])?.at(-2)?.total || 0))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['7d', '30d', '90d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:text-text-primary border border-border'}`}>
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Scans" value={(k.totalScans ?? 0).toLocaleString()} icon={Activity} color="#3b82f6" trend={scansTrend ? 'up' : 'down'} />
        <KpiCard label="Total Users" value={(k.totalUsers ?? 0).toLocaleString()} icon={Users} color="#60a5fa" />
        <KpiCard label="Active (7d)" value={(k.activeUsers ?? 0).toLocaleString()} icon={Radio} color="#34d399" sub={`${Math.round((k.activeUsers ?? 0) * 100 / (k.totalUsers || 1))}% of total`} />
        <KpiCard label="Inactive" value={(k.inactiveUsers ?? 0).toLocaleString()} icon={Clock} color="#f59e0b" />
        <KpiCard label="Paid Users" value={(k.paidUsers ?? 0).toLocaleString()} icon={Crown} color="#fbbf24" />
        <KpiCard label="Banned" value={(k.bannedUsers ?? 0).toLocaleString()} icon={Ban} color="#f87171" />
        <KpiCard label="Admin-Granted" value={(k.adminGranted ?? 0).toLocaleString()} icon={Star} color="#a78bfa" />
        <KpiCard label="New Today" value={(k.newToday ?? 0).toLocaleString()} icon={Zap} color="#34d399" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-text-primary mb-4">Daily Scans</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d?.dailyScans ?? []}>
              <defs><linearGradient id="gAI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/><stop offset="95%" stopColor="#f87171" stopOpacity={0}/></linearGradient><linearGradient id="gH" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/><stop offset="95%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} labelStyle={{ color: '#a0aec0' }} />
              <Area type="monotone" dataKey="ai" stroke="#f87171" fill="url(#gAI)" strokeWidth={2} name="AI" />
              <Area type="monotone" dataKey="human" stroke="#34d399" fill="url(#gH)" strokeWidth={2} name="Human" />
              <Area type="monotone" dataKey="uncertain" stroke="#fbbf24" fill="none" strokeWidth={1.5} strokeDasharray="3 3" name="Uncertain" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-text-primary mb-4">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={d?.planDistribution ?? []} dataKey="count" nameKey="plan" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4}>
              {(d?.planDistribution ?? []).map((entry: any, i: number) => <Cell key={i} fill={PLAN_COLORS[entry.plan] || '#64748b'} />)}
            </Pie><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-text-primary mb-4">Verdict Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d?.verdictDistribution ?? []}><XAxis dataKey="verdict" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="count" radius={[4,4,0,0]}>{(d?.verdictDistribution ?? []).map((entry: any, i: number) => <Cell key={i} fill={VERDICT_COLORS[entry.verdict] || '#64748b'} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-text-primary mb-4">Tool Usage</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d?.toolUsage ?? []}><XAxis dataKey="tool" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-text-primary mb-4">User Growth</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={d?.dailyUsers ?? []}><XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Line type="monotone" dataKey="new_users" stroke="#a78bfa" strokeWidth={2} dot={false} /></LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
