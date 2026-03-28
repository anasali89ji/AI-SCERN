'use client'
import { useEffect, useState, useCallback } from 'react'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { Scan, Users, Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Shield, Ban, Eye, TrendingUp, Database, Globe } from 'lucide-react'

const C = { primary:'#7c3aed', success:'#10b981', warning:'#f59e0b', danger:'#f43f5e', muted:'#64748b', blue:'#3b82f6' }

function StatCard({ title, value, sub, icon: Icon, color, loading }: any) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted font-medium">{title}</p>
        {loading ? (
          <div className="h-6 w-16 bg-surface-active animate-pulse rounded mt-1" />
        ) : (
          <p className="text-xl font-black text-text-primary mt-0.5">{value}</p>
        )}
        {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function EventBadge({ event }: { event: string }) {
  const config: Record<string, { color: string; label: string }> = {
    signup:   { color: C.success,  label: 'Signed Up' },
    signin:   { color: C.primary,  label: 'Signed In' },
    signout:  { color: C.muted,    label: 'Signed Out' },
    page_view:{ color: C.blue,     label: 'Page View' },
  }
  const c = config[event] || { color: C.muted, label: event }
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${c.color}18`, color: c.color }}>
      {c.label}
    </span>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastRefresh(new Date())
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
    const t = setInterval(fetchStats, 30000) // auto-refresh every 30s
    return () => clearInterval(t)
  }, [fetchStats])

  const radarData = [
    { m: 'Text',  acc: 87 },
    { m: 'Image', acc: 82 },
    { m: 'Audio', acc: 78 },
    { m: 'Video', acc: 75 },
  ]

  const modalityChart = Object.entries(stats?.scansByModality || {}).map(([k, v]) => ({ name: k, value: v as number }))

  return (
    <RoleGuard required="MANAGER">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-text-primary">Platform Overview</h1>
            <p className="text-xs text-text-muted mt-0.5">Live data · Auto-refreshes every 30s</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-disabled">Last updated: {lastRefresh.toLocaleTimeString()}</span>
            <button onClick={fetchStats} className="p-1.5 rounded-lg border border-border hover:bg-surface-active transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald/10 border border-emerald/20 text-[10px] text-emerald font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />LIVE
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard title="Total Users" value={stats?.totalUsers?.toLocaleString() || '—'} sub={`+${stats?.signupsToday || 0} today`} icon={Users} color={C.primary} loading={loading} />
          <StatCard title="Active Today" value={stats?.activeToday?.toLocaleString() || '—'} sub="unique users (24h)" icon={Activity} color={C.success} loading={loading} />
          <StatCard title="Total Scans" value={stats?.totalScans?.toLocaleString() || '—'} sub={`${stats?.scansToday || 0} today`} icon={Scan} color={C.blue} loading={loading} />
          <StatCard title="Banned / Revoked" value={`${stats?.bannedUsers || 0} / ${stats?.revokedUsers || 0}`} sub="accounts restricted" icon={Shield} color={C.danger} loading={loading} />
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Live Activity Feed */}
          <div className="lg:col-span-3 rounded-xl border border-border bg-surface/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                Live User Activity
              </h3>
              <span className="text-[10px] text-text-disabled">Last 50 events</span>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-8 bg-surface-active animate-pulse rounded" />
                ))
              ) : (stats?.recentSessions || []).length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">No sessions tracked yet</p>
              ) : (
                (stats?.recentSessions || []).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-active/50 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[9px] font-black text-primary">
                      {(s.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-text-primary truncate">{s.email || s.user_id?.slice(0, 12)}</p>
                      <p className="text-[9px] text-text-muted">{s.page || '/'} · {s.ip}</p>
                    </div>
                    <EventBadge event={s.event} />
                    <span className="text-[9px] text-text-disabled whitespace-nowrap">
                      {new Date(s.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Model Accuracy Radar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <h3 className="text-sm font-bold text-text-primary mb-3">Detection Accuracy</h3>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e1e2e" />
                  <PolarAngleAxis dataKey="m" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Radar dataKey="acc" stroke={C.primary} fill={C.primary} fillOpacity={0.15} />
                  <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${v}%`, 'Accuracy']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Signups */}
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <h3 className="text-sm font-bold text-text-primary mb-3">Recent Signups</h3>
              <div className="space-y-1.5">
                {(stats?.recentSignups || []).slice(0, 5).map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                      {(u.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] text-text-muted truncate flex-1">{u.email}</span>
                    <span className="text-[9px] text-text-disabled whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {!loading && !stats?.recentSignups?.length && (
                  <p className="text-xs text-text-muted text-center py-3">No signups yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scans by Modality */}
        {modalityChart.length > 0 && (
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <h3 className="text-sm font-bold text-text-primary mb-3">Scans by Modality</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={modalityChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill={C.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
