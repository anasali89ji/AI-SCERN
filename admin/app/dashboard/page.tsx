'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Database, Users, Brain, Activity, Upload, RefreshCw,
  LogOut, BarChart3, Globe, AlertTriangle, CheckCircle,
  XCircle, Clock, Loader2, Terminal, Heart,
  TrendingUp, Server, GitBranch, Eye, Wifi, WifiOff,
  AlertCircle, Play, Zap, Radio
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts'

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: BarChart3  },
  { id: 'pipeline',  label: 'Pipeline',  icon: Activity   },
  { id: 'health',    label: 'Health',    icon: Heart      },
  { id: 'dataset',   label: 'Dataset',   icon: Database   },
  { id: 'scans',     label: 'Scans',     icon: Eye        },
  { id: 'users',     label: 'Users',     icon: Users      },
  { id: 'logs',      label: 'Logs',      icon: Terminal   },
]

const STATUS_COLORS: Record<string,string> = {
  pending:'#f59e0b', running:'#3b82f6', done:'#10b981',
  failed:'#f43f5e',  completed:'#10b981', partial:'#f59e0b',
  alive:'#10b981',   degraded:'#f59e0b', dead:'#f43f5e',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  const spinning = status === 'running'
  const Icon = status === 'running' ? Loader2 : status === 'done' || status === 'completed' ? CheckCircle
             : status === 'failed' ? XCircle : status === 'pending' ? Clock : Activity
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
      <Icon className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`}/>
      {status}
    </span>
  )
}

function StatCard({ label, value, sub, color, icon: Icon, trend }: any) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}, transparent 60%)` }}/>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-muted font-medium uppercase tracking-widest">{label}</p>
        {Icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }}/>
        </div>}
      </div>
      <p className="text-3xl font-black text-text-primary">{value ?? '—'}</p>
      {sub   && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      {trend !== undefined && <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} vs last run
      </p>}
    </div>
  )
}

function LiveDot({ color = '#10b981' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }}/>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }}/>
    </span>
  )
}

function HeartbeatBar({ beats }: { beats: any[] }) {
  if (!beats?.length) return <p className="text-text-muted text-sm">No heartbeats yet</p>
  const last = beats[0]
  const secsAgo = Math.floor((Date.now() - new Date(last.beat_at).getTime()) / 1000)
  const color = last.status === 'alive' ? '#10b981' : last.status === 'degraded' ? '#f59e0b' : '#f43f5e'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <LiveDot color={color}/>
        <span className="text-sm font-semibold capitalize" style={{ color }}>{last.status}</span>
        <span className="text-xs text-text-muted">last beat {secsAgo}s ago</span>
        <span className="ml-auto text-xs text-text-muted">{last.message}</span>
      </div>
      <div className="flex gap-1">
        {beats.slice(0, 40).reverse().map((b: any, i: number) => (
          <div key={i} className="flex-1 h-8 rounded-sm transition-all"
            style={{ background: b.status === 'alive' ? '#10b981' : b.status === 'degraded' ? '#f59e0b' : '#f43f5e',
              opacity: 0.5 + (i / beats.length) * 0.5 }}
            title={`${new Date(b.beat_at).toLocaleTimeString()} — ${b.status}: ${b.message}`}/>
        ))}
      </div>
      <p className="text-xs text-text-muted text-right">← last 40 heartbeats</p>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [healthData, setHealthData] = useState<any>({ runs: [], beats: [], alerts: [], overview: {} })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date|null>(null)
  const logsRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const [pipelineRes, logsRes, healthRes] = await Promise.all([
        fetch('/api/pipeline'),
        fetch('/api/logs'),
        fetch('/api/health'),
      ])
      if (pipelineRes.ok) setData(await pipelineRes.json())
      if (logsRes.ok)     setLogs((await logsRes.json()).logs || [])
      if (healthRes.ok)   setHealthData(await healthRes.json())
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Smart auto-refresh: 8s when running, 15s otherwise
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!autoRefresh) return
    const jobs = data?.jobs || []
    const hasActive = jobs.some((j: any) => ['pending','running'].includes(j.status))
    const interval  = hasActive ? 8000 : 15000
    intervalRef.current = setInterval(() => fetchData(true), interval)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, fetchData, data])

  useEffect(() => {
    if (logsRef.current && tab === 'logs') {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs, tab])

  const triggerPipeline = async () => {
    setTriggering(true)
    try {
      await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'run' }),
      })
      setTimeout(() => fetchData(true), 2000)
    } catch {}
    setTriggering(false)
  }

  const triggerJob = async (job_type: string) => {
    try {
      await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', job_type }),
      })
      fetchData(true)
    } catch {}
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  const jobs     = data?.jobs    || []
  const dataset  = data?.dataset || []
  const scans    = data?.scans   || []
  const profiles = data?.profiles|| []

  const runningJobs = jobs.filter((j: any) => j.status === 'running').length
  const pendingJobs = jobs.filter((j: any) => j.status === 'pending').length
  const doneJobs    = jobs.filter((j: any) => j.status === 'done').length
  const failedJobs  = jobs.filter((j: any) => j.status === 'failed').length

  const overview    = healthData.overview  || {}
  const beats       = healthData.beats     || []
  const runs        = healthData.runs      || []
  const alerts      = healthData.alerts    || []

  const health       = overview?.health || {}
  const pipelineAlive = health?.status === 'healthy'
  const totalItems    = overview?.total_items || dataset.length
  const cleanItems    = overview?.clean_items || 0
  const items24h      = overview?.items_24h   || 0
  const items1h       = overview?.items_1h    || 0

  const datasetStats = dataset.reduce((a: any, i: any) => {
    const k = `${i.media_type}_${i.label}`; a[k] = (a[k] || 0) + 1; return a
  }, {})
  const pieData = Object.entries(datasetStats).map(([k, v]) => ({
    name: k.replace('_', ' '), value: v as number,
    color: k.includes('ai') ? '#f43f5e' : '#10b981'
  }))

  const throughput24h = data?.throughput_24h || {}
  const runTrend = runs.slice(0,10).reverse().map((r: any, i: number) => ({
    i, scraped: r.items_scraped || 0, cleaned: r.items_cleaned || 0, uploaded: r.items_uploaded || 0,
    status: r.status
  }))

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto"/>
        <p className="text-text-muted">Loading admin panel…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary"/>
            <span className="font-black text-text-primary text-sm">DETECTAI</span>
          </div>
          <span className="text-xs text-text-muted font-medium px-1 py-0.5 bg-primary/10 text-primary rounded">
            Admin Panel
          </span>
        </div>

        {/* Pipeline status chip */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <LiveDot color={pipelineAlive ? '#10b981' : '#f59e0b'}/>
            <span className="text-xs text-text-muted">
              {pipelineAlive ? 'Pipeline healthy' : 'Pipeline degraded'}
            </span>
          </div>
          {alerts.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="w-3 h-3"/> {alerts.length} alert{alerts.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === t.id ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}>
              <t.icon className="w-4 h-4"/>
              {t.label}
              {t.id === 'pipeline' && runningJobs > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
              )}
              {t.id === 'pipeline' && pendingJobs > 0 && runningJobs === 0 && (
                <span className="ml-auto text-xs bg-amber-400/20 text-amber-400 rounded-full px-1.5">
                  {pendingJobs}
                </span>
              )}
              {t.id === 'health' && alerts.length > 0 && (
                <span className="ml-auto text-xs bg-rose-400/20 text-rose-400 rounded-full px-1.5">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setAutoRefresh(a => !a)}
              className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 transition-all ${autoRefresh ? 'text-emerald-400 bg-emerald-400/10' : 'text-text-muted bg-white/5'}`}>
              {autoRefresh ? <Wifi className="w-3 h-3"/> : <WifiOff className="w-3 h-3"/>}
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button onClick={() => fetchData()} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-all ml-auto">
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}/>
            </button>
          </div>
          {lastRefresh && <p className="text-[10px] text-text-muted">{lastRefresh.toLocaleTimeString()}</p>}
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-all">
            <LogOut className="w-4 h-4"/>Logout
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-text-primary capitalize">{tab}</h1>
              <p className="text-sm text-text-muted mt-0.5">
                {tab === 'pipeline' && `${jobs.length} total · ${runningJobs} running · ${pendingJobs} pending · ${failedJobs} failed`}
                {tab === 'health'   && `${runs.length} runs · ${alerts.length} active alerts`}
                {tab === 'dataset'  && `${totalItems.toLocaleString()} total items · ${cleanItems.toLocaleString()} clean`}
                {tab === 'overview' && 'Real-time platform metrics'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {(tab === 'pipeline' || tab === 'overview') && (
                <button onClick={triggerPipeline} disabled={triggering}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all">
                  {triggering ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
                  Run Pipeline Now
                </button>
              )}
            </div>
          </div>

          {/* Active alerts banner */}
          {alerts.length > 0 && (
            <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5"/>
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-300">{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</p>
                <div className="space-y-1 mt-1">
                  {alerts.map((a: any) => (
                    <p key={a.id} className="text-xs text-rose-400/80">{a.title}: {a.message}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── OVERVIEW ────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Items"   value={totalItems.toLocaleString()} sub={`${items24h} added today`}          icon={Database}    color="#7c3aed"/>
                <StatCard label="Last Hour"     value={items1h}                     sub="items scraped"                      icon={Zap}         color="#3b82f6"/>
                <StatCard label="Clean Rate"    value={totalItems ? `${Math.round(cleanItems/totalItems*100)}%` : '—'} sub="deduplicated"  icon={CheckCircle} color="#10b981"/>
                <StatCard label="Total Users"   value={profiles.length}             sub="registered"                         icon={Users}       color="#f59e0b"/>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <StatCard label="Total Scans"   value={scans.length}                sub="all time"  icon={Eye}         color="#ec4899"/>
                <StatCard label="Pipeline Runs" value={runs.length}                 sub="all time"  icon={GitBranch}   color="#14b8a6"/>
                <StatCard label="Active Alerts" value={alerts.length}               sub={alerts.length === 0 ? 'All clear ✓' : 'needs attention'} icon={AlertCircle} color={alerts.length === 0 ? '#10b981' : '#f43f5e'}/>
              </div>

              {/* 24h throughput */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Scraped (24h)',  value: throughput24h.scraped  || 0, color: '#7c3aed' },
                  { label: 'Cleaned (24h)',  value: throughput24h.cleaned  || 0, color: '#3b82f6' },
                  { label: 'Uploaded (24h)', value: throughput24h.uploaded || 0, color: '#10b981' },
                ].map(m => (
                  <div key={m.label} className="bg-surface border border-border rounded-2xl p-5 text-center">
                    <p className="text-xs text-text-muted uppercase tracking-widest mb-2">{m.label}</p>
                    <p className="text-4xl font-black" style={{ color: m.color }}>{m.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Run trend chart */}
              {runTrend.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary"/> Recent Pipeline Runs
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={runTrend}>
                      <XAxis dataKey="i" hide/>
                      <YAxis hide/>
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: 8 }}/>
                      <Area type="monotone" dataKey="scraped"  stroke="#7c3aed" fill="#7c3aed20" strokeWidth={2}/>
                      <Area type="monotone" dataKey="cleaned"  stroke="#3b82f6" fill="#3b82f620" strokeWidth={2}/>
                      <Area type="monotone" dataKey="uploaded" stroke="#10b981" fill="#10b98120" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-6 mt-2 justify-center">
                    {[['Scraped','#7c3aed'],['Cleaned','#3b82f6'],['Uploaded','#10b981']].map(([l,c]) => (
                      <div key={l} className="flex items-center gap-1.5 text-xs text-text-muted">
                        <div className="w-2 h-2 rounded-full" style={{ background: c as string }}/>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PIPELINE ────────────────────────────── */}
          {tab === 'pipeline' && (
            <div className="space-y-5">
              {/* Heartbeat monitor */}
              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-4">
                  <Radio className="w-4 h-4 text-primary"/> Live Heartbeat Monitor
                </h3>
                <HeartbeatBar beats={beats}/>
              </div>

              {/* Pipeline stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pending"  value={pendingJobs}  icon={Clock}        color="#f59e0b"/>
                <StatCard label="Running"  value={runningJobs}  icon={Loader2}      color="#3b82f6"/>
                <StatCard label="Done"     value={doneJobs}     icon={CheckCircle}  color="#10b981"/>
                <StatCard label="Failed"   value={failedJobs}   icon={XCircle}      color="#f43f5e"/>
              </div>

              {/* Manual job triggers */}
              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary"/> Manual Triggers
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { type:'scrape',  label:'Scrape Data',   icon: Globe,   color:'#10b981' },
                    { type:'clean',   label:'Clean & Dedupe',icon: Brain,   color:'#3b82f6' },
                    { type:'augment', label:'Augment',       icon: TrendingUp, color:'#f59e0b' },
                    { type:'upload',  label:'Upload to HF',  icon: Upload,  color:'#7c3aed' },
                  ].map(({ type, label, icon: Icon, color }) => (
                    <button key={type} onClick={() => triggerJob(type)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all hover:scale-105 active:scale-95"
                      style={{ borderColor: `${color}40`, color, background: `${color}10` }}>
                      <Icon className="w-4 h-4"/>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule info */}
              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary"/> Automation Schedule
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { name: 'Orchestrator',    schedule: 'Every 5 min',  color: '#3b82f6', active: true },
                    { name: 'Scraper',         schedule: 'Every hour',   color: '#10b981', active: true },
                    { name: 'Cleaner',         schedule: 'Daily 3am UTC',color: '#7c3aed', active: true },
                    { name: 'Uploader',        schedule: 'Daily 4am UTC',color: '#f59e0b', active: true },
                    { name: 'Health Monitor',  schedule: 'Every 10 min', color: '#ec4899', active: true },
                    { name: 'Metrics Cleanup', schedule: 'Daily midnight',color: '#14b8a6', active: true },
                  ].map(s => (
                    <div key={s.name} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{s.name}</p>
                        <p className="text-xs text-text-muted">{s.schedule}</p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0"/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jobs table */}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">Job Queue</h3>
                  <span className="text-xs text-text-muted">{jobs.length} total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Type','Status','Attempt','Triggered By','Duration','Result','Created'].map(h => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 50).map((job: any) => (
                        <tr key={job.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-medium text-text-primary capitalize">{job.job_type}</td>
                          <td className="px-4 py-3"><StatusBadge status={job.status}/></td>
                          <td className="px-4 py-3 text-text-muted text-xs">{job.attempt || 0}/{job.max_attempts || 3}</td>
                          <td className="px-4 py-3 text-text-muted text-xs max-w-[140px] truncate">{job.triggered_by || '—'}</td>
                          <td className="px-4 py-3 text-text-muted text-xs">
                            {job.duration_ms ? `${(job.duration_ms/1000).toFixed(1)}s` : '—'}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs max-w-[180px] truncate">
                            {job.result ? JSON.stringify(job.result).slice(0,80) : job.error_log?.at(-1)?.error?.slice(0,60) || '—'}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs">{new Date(job.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">No jobs yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── HEALTH ──────────────────────────────── */}
          {tab === 'health' && (
            <div className="space-y-5">
              {/* Health summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pipeline Status" value={health?.status || '?'} icon={Activity}    color={STATUS_COLORS[health?.status] || '#6b7280'}/>
                <StatCard label="Total Runs"       value={runs.length}           icon={GitBranch}   color="#7c3aed"/>
                <StatCard label="Active Alerts"    value={alerts.length}         icon={AlertCircle} color={alerts.length === 0 ? '#10b981' : '#f43f5e'}/>
                <StatCard label="Items (24h)"      value={items24h}              icon={Database}    color="#10b981"/>
              </div>

              {/* Heartbeat history */}
              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-primary"/> Heartbeat History
                </h3>
                <HeartbeatBar beats={beats}/>
                <div className="mt-4 max-h-40 overflow-y-auto space-y-1">
                  {beats.slice(0,10).map((b: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/30">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[b.status] || '#6b7280' }}/>
                      <span className="text-text-muted w-24 shrink-0">{new Date(b.beat_at).toLocaleTimeString()}</span>
                      <span className="capitalize font-medium" style={{ color: STATUS_COLORS[b.status] || '#6b7280' }}>{b.status}</span>
                      <span className="text-text-muted truncate">{b.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Run history */}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="font-semibold text-text-primary">Pipeline Run History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Run ID','Status','Jobs','Scraped','Cleaned','Uploaded','Duration','Started'].map(h => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runs.slice(0,30).map((run: any) => {
                        const dur = run.completed_at && run.started_at
                          ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                          : null
                        return (
                          <tr key={run.run_id} className="border-b border-border/50 hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-mono text-xs text-text-muted">{run.run_id?.slice(0,12)}…</td>
                            <td className="px-4 py-3"><StatusBadge status={run.status}/></td>
                            <td className="px-4 py-3 text-text-secondary">{run.jobs_done}/{run.jobs_total}</td>
                            <td className="px-4 py-3" style={{ color:'#7c3aed' }}>{run.items_scraped  || 0}</td>
                            <td className="px-4 py-3" style={{ color:'#3b82f6' }}>{run.items_cleaned  || 0}</td>
                            <td className="px-4 py-3" style={{ color:'#10b981' }}>{run.items_uploaded || 0}</td>
                            <td className="px-4 py-3 text-text-muted">{dur ? `${dur}s` : run.status === 'running' ? '⏳' : '—'}</td>
                            <td className="px-4 py-3 text-text-muted text-xs">{new Date(run.started_at).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                      {runs.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">No runs yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── DATASET ─────────────────────────────── */}
          {tab === 'dataset' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Items"  value={totalItems.toLocaleString()} icon={Database}    color="#7c3aed"/>
                <StatCard label="Clean Items"  value={cleanItems.toLocaleString()} icon={CheckCircle} color="#10b981"/>
                <StatCard label="AI Samples"   value={(overview?.ai_items    || 0).toLocaleString()} icon={Brain} color="#f43f5e"/>
                <StatCard label="Human Samples" value={(overview?.human_items || 0).toLocaleString()} icon={Users} color="#3b82f6"/>
              </div>
              {pieData.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-8">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                        {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {pieData.map((d: any) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: d.color }}/>
                        <span className="text-sm text-text-primary capitalize">{d.name}</span>
                        <span className="ml-auto font-bold" style={{ color: d.color }}>{d.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold text-text-primary">Dataset Items</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Type','Source','Label','Confidence','Split','Status','Created'].map(h => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.slice(0,100).map((item: any) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-text-muted capitalize">{item.media_type}</td>
                          <td className="px-4 py-3 text-text-secondary text-xs">{item.source_name}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold" style={{ color: item.label === 'ai' ? '#f43f5e' : '#10b981' }}>
                              {item.label?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-muted">{(item.confidence * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-text-muted text-xs">{item.split}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: item.is_deduplicated ? '#10b981' : '#f59e0b' }}>
                            {item.is_deduplicated ? '✓ Clean' : '⏳ Pending'}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SCANS ───────────────────────────────── */}
          {tab === 'scans' && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold text-text-primary">Recent Scans</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Type','Result','Confidence','User','Created'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scans.slice(0,50).map((s: any) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 capitalize text-text-secondary">{s.scan_type || s.type}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold" style={{ color: s.result === 'ai' ? '#f43f5e' : '#10b981' }}>
                          {s.result?.toUpperCase() || '—'}</span></td>
                        <td className="px-4 py-3 text-text-muted">{s.confidence ? `${(s.confidence*100).toFixed(0)}%` : '—'}</td>
                        <td className="px-4 py-3 text-text-muted text-xs font-mono">{s.user_id?.slice(0,8)}…</td>
                        <td className="px-4 py-3 text-text-muted text-xs">{new Date(s.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {scans.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">No scans yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── USERS ───────────────────────────────── */}
          {tab === 'users' && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold text-text-primary">Users — {profiles.length} registered</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['ID','Display Name','Plan','Created'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.slice(0,50).map((u: any) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-xs text-text-muted">{u.id?.slice(0,8)}…</td>
                        <td className="px-4 py-3 text-text-primary">{u.display_name || '—'}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold text-primary capitalize">{u.plan || 'free'}</span></td>
                        <td className="px-4 py-3 text-text-muted text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LOGS ────────────────────────────────── */}
          {tab === 'logs' && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary"/> System Logs
                </h3>
              </div>
              <div ref={logsRef} className="bg-[#0a0a0f] p-4 h-[600px] overflow-y-auto font-mono text-xs space-y-0.5">
                {logs.length === 0
                  ? <p className="text-text-muted">No logs yet…</p>
                  : logs.map((log: any, i: number) => (
                    <div key={i} className="flex gap-3 hover:bg-white/[0.02] px-1 py-0.5 rounded">
                      <span className="text-text-muted shrink-0 w-24">{new Date(log.timestamp || log.created_at).toLocaleTimeString()}</span>
                      <span className={`shrink-0 w-16 ${log.level === 'error' ? 'text-rose-400' : log.level === 'warn' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        [{log.level?.toUpperCase() || 'INFO'}]
                      </span>
                      <span className="text-gray-300 break-all">{log.message || JSON.stringify(log)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
