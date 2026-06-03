'use client'
import { useCallback } from 'react'
import useSWR from 'swr'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { Activity, Users, Radio, Clock, Crown, Ban, Star, Zap, RefreshCw } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import { ShimmerCard } from '../components/ShimmerBlock'
import { api } from '@/lib/api-client'

const fetcher = (path: string) => api<Record<string, unknown>>(path)

const PLAN_COLORS: Record<string, string> = {
  free: '#64748b', pro: '#2563eb', team: '#06b6d4', enterprise: '#f59e0b'
}
const VERDICT_COLORS: Record<string, string> = {
  AI: '#f87171', HUMAN: '#34d399', UNCERTAIN: '#fbbf24'
}

function PeriodPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      {(['7d', '30d', '90d'] as const).map(p => (
        <button key={p} onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
            focus:outline-none focus:ring-2 focus:ring-primary/50
            ${value === p
              ? 'bg-primary text-white'
              : 'bg-surface text-text-muted hover:text-text-primary border border-border'}`}>
          {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
        </button>
      ))}
    </div>
  )
}

export default function OverviewTab() {
  const { data, error, isLoading, mutate } = useSWR<Record<string, unknown>>(
    '/analytics?period=7d', fetcher, { refreshInterval: 60000 }
  )

  const k = (data as Record<string, unknown> & { kpis?: Record<string, number> })?.kpis ?? {}

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-rose-400 mb-3">Failed to load analytics</p>
      <button onClick={() => mutate()} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  )

  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(8).fill(0).map((_, i) => <ShimmerCard key={i} />)}
      </div>
    </div>
  )

  const d = data as Record<string, unknown>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PeriodPicker value="7d" onChange={() => {}} />
        <button onClick={() => mutate()} aria-label="Refresh data"
          className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Scans"   value={(k.totalScans   ?? 0).toLocaleString()} icon={Activity} color="#3b82f6" />
        <KpiCard label="Total Users"   value={(k.totalUsers   ?? 0).toLocaleString()} icon={Users}    color="#60a5fa" />
        <KpiCard label="Active (7d)"   value={(k.activeUsers  ?? 0).toLocaleString()} icon={Radio}    color="#34d399"
          sub={`${Math.round(((k.activeUsers ?? 0) as number) * 100 / ((k.totalUsers ?? 1) as number))}% of total`} />
        <KpiCard label="Inactive"      value={(k.inactiveUsers ?? 0).toLocaleString()} icon={Clock}   color="#f59e0b" />
        <KpiCard label="Paid Users"    value={(k.paidUsers    ?? 0).toLocaleString()} icon={Crown}    color="#fbbf24" />
        <KpiCard label="Banned"        value={(k.bannedUsers  ?? 0).toLocaleString()} icon={Ban}      color="#f87171" />
        <KpiCard label="Admin-Granted" value={(k.adminGranted ?? 0).toLocaleString()} icon={Star}     color="#a78bfa" />
        <KpiCard label="New Today"     value={(k.newToday     ?? 0).toLocaleString()} icon={Zap}      color="#34d399" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">Daily Scans</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={(d?.dailyScans as unknown[]) ?? []}>
              <defs>
                <linearGradient id="gAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} labelStyle={{ color: '#a0aec0' }} />
              <Area type="monotone" dataKey="ai"        stroke="#f87171" fill="url(#gAI)" strokeWidth={2} name="AI" />
              <Area type="monotone" dataKey="human"     stroke="#34d399" fill="url(#gH)"  strokeWidth={2} name="Human" />
              <Area type="monotone" dataKey="uncertain" stroke="#fbbf24" fill="none"      strokeWidth={1.5} strokeDasharray="3 3" name="Uncertain" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">User Growth</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(d?.dailyUsers as unknown[]) ?? []}>
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} labelStyle={{ color: '#a0aec0' }} />
              <Bar dataKey="new_users" fill="#2563eb" radius={[4, 4, 0, 0]} name="New Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={(d?.planBreakdown as unknown[]) ?? []} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {((d?.planBreakdown as Array<{ name: string }>) ?? []).map((entry) => (
                  <Cell key={entry.name} fill={PLAN_COLORS[entry.name.toLowerCase()] ?? '#64748b'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">Verdict Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={(d?.verdictBreakdown as unknown[]) ?? []} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {((d?.verdictBreakdown as Array<{ name: string }>) ?? []).map((entry) => (
                  <Cell key={entry.name} fill={VERDICT_COLORS[entry.name.toUpperCase()] ?? '#64748b'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
