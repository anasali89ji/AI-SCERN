'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Activity, LogOut, RefreshCw, Loader2, Users, CreditCard,
  BarChart3, Database, Flag, Lock, Key, CheckCircle, XCircle, TrendingUp,
  AlertTriangle, Play, Zap, Crown, Ban, DollarSign, Radio, Server
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// All data fetched through internal API routes (no hardcoded credentials)
async function api(path: string, method = 'GET', body?: any) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: BarChart3  },
  { id: 'users',         label: 'Users',         icon: Users      },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'analytics',     label: 'Analytics',     icon: Activity   },
  { id: 'pipeline',      label: 'Pipeline',      icon: Database   },
  { id: 'flags',         label: 'Feature Flags', icon: Flag       },
  { id: 'security',      label: 'Security',      icon: Lock       },
  { id: 'apikeys',       label: 'API Keys',      icon: Key        },
]

const PLAN_COLORS: Record<string,string> = {
  free: '#6b7280', starter: '#22d3ee', pro: '#a855f7', enterprise: '#f59e0b'
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/stats/overview').then(d => { setStats(d); setLoading(false) })
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  const planDist = Object.entries(stats?.planDistribution || {}).map(([name, value]) => ({ name, value }))
  const typeDist = Object.entries(stats?.scanTypeDistribution || {}).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',           value: stats?.totalUsers,           icon: Users,       color: 'text-cyan-400'   },
          { label: 'Active Subscriptions',  value: stats?.activeSubscriptions,  icon: CreditCard,  color: 'text-purple-400' },
          { label: 'Scans Today',           value: stats?.scansToday,           icon: Activity,    color: 'text-green-400'  },
          { label: 'Banned Accounts',       value: stats?.bannedUsers,          icon: Ban,         color: 'text-rose-400'   },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-black text-white">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-800/60 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={planDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                {planDist.map(entry => <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || '#6b7280'} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Scans by Type (Today)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeDist}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
              <Bar dataKey="value" fill="#a855f7" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]       = useState<any[]>([])
  const [total, setTotal]       = useState(0)
  const [q, setQ]               = useState('')
  const [planFilter, setPlan]   = useState('')
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [action, setAction]     = useState<{ userId: string; type: string } | null>(null)
  const [actionVal, setActionVal] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api(`/users?q=${q}&plan=${planFilter}&page=${page}`)
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); setLoading(false) })
  }, [q, planFilter, page])

  useEffect(() => { load() }, [load])

  const doAction = async () => {
    if (!action) return
    if (action.type === 'credits') {
      await api(`/users/${action.userId}/credits`, 'POST', { delta: parseInt(actionVal), reason: 'admin_grant' })
    } else if (action.type === 'plan') {
      await api(`/users/${action.userId}/plan`, 'POST', { planId: actionVal })
    } else if (action.type === 'ban') {
      await api(`/users/${action.userId}/ban`, 'POST', { ban: true, reason: actionVal })
    } else if (action.type === 'unban') {
      await api(`/users/${action.userId}/ban`, 'POST', { ban: false })
    }
    setAction(null); setActionVal(''); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or name…"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-48 outline-none focus:border-purple-500" />
        <select value={planFilter} onChange={e => setPlan(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Plans</option>
          <option value="free">Free</option><option value="starter">Starter</option>
          <option value="pro">Pro</option><option value="enterprise">Enterprise</option>
        </select>
        <button onClick={load} className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-300" />
        </button>
      </div>
      <p className="text-xs text-gray-400">{total} users found</p>
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700 bg-gray-800/80">
            {['Email', 'Plan', 'Credits', 'Scans', 'Status', 'Joined', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" /></td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-3 text-gray-200 max-w-48 truncate">{u.email || u.display_name || u.id.slice(0,8)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: (PLAN_COLORS[u.plan_id || 'free'] || '#6b7280') + '30', color: PLAN_COLORS[u.plan_id || 'free'] || '#9ca3af' }}>
                    {u.plan_id || 'free'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{u.credits_remaining ?? '—'}</td>
                <td className="px-4 py-3 text-gray-300">{u.scan_count ?? 0}</td>
                <td className="px-4 py-3">
                  {u.is_banned
                    ? <span className="text-xs text-rose-400 font-semibold">Banned</span>
                    : <span className="text-xs text-green-400">Active</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => setAction({ userId: u.id, type: 'credits' })} title="Grant credits"
                      className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                      <Zap className="w-3 h-3" />
                    </button>
                    <button onClick={() => setAction({ userId: u.id, type: 'plan' })} title="Change plan"
                      className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors">
                      <Crown className="w-3 h-3" />
                    </button>
                    <button onClick={() => setAction({ userId: u.id, type: u.is_banned ? 'unban' : 'ban' })} title={u.is_banned ? 'Unban' : 'Ban'}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors">
                      <Ban className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action modal */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 space-y-4">
            <h3 className="text-white font-bold capitalize">{action.type === 'unban' ? 'Unban User' : action.type}</h3>
            {action.type !== 'unban' && (
              <input value={actionVal} onChange={e => setActionVal(e.target.value)}
                placeholder={action.type === 'credits' ? 'Delta (e.g. 50 or -10)' : action.type === 'plan' ? 'Plan ID (free/starter/pro)' : 'Reason'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            )}
            <div className="flex gap-3">
              <button onClick={() => setAction(null)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800">Cancel</button>
              <button onClick={doAction} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Feature Flags Tab ─────────────────────────────────────────────────────────
function FlagsTab() {
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/feature-flags').then(d => { setFlags(d.flags || []); setLoading(false) })
  }, [])

  const toggle = async (key: string, enabled: boolean) => {
    await api(`/feature-flags/${key}`, 'POST', { enabled: !enabled })
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !enabled } : f))
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  return (
    <div className="space-y-3">
      {flags.map(flag => (
        <div key={flag.key} className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-xl px-5 py-4">
          <div>
            <p className="text-white font-semibold text-sm">{flag.key}</p>
            <p className="text-gray-400 text-xs mt-0.5">{flag.description || '—'} · {flag.rollout_pct}% rollout</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${flag.enabled ? 'text-green-400' : 'text-rose-400'}`}>
              {flag.enabled ? 'ON' : 'OFF'}
            </span>
            <button onClick={() => toggle(flag.key, flag.enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${flag.enabled ? 'bg-green-500' : 'bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${flag.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Security Audit Tab ────────────────────────────────────────────────────────
function SecurityTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/audit-log').then(d => { setLogs(d.logs || []); setLoading(false) })
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700 bg-gray-800/80">
            {['Action', 'Target', 'IP', 'Time'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-purple-400 font-mono text-xs">{log.action}</td>
                <td className="px-4 py-3 text-gray-300 text-xs">{log.target_user_id?.slice(0,12) || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.admin_ip || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-center py-8 text-gray-500">No audit log entries yet.</p>}
      </div>
    </div>
  )
}

// ── Pipeline Tab — Real Cloudflare D1 Data ───────────────────────────────────
function PipelineTab() {
  const [data,      setData]      = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [triggering,setTriggering]= useState(false)
  const [trigResult,setTrigResult]= useState<any>(null)
  const [error,     setError]     = useState('')

  const load = () => {
    setLoading(true); setError('')
    fetch('/api/pipeline').then(r => r.json()).then(d => {
      if (d.ok === false) setError(d.error + (d.hint ? `\n${d.hint}` : ''))
      else setData(d)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const triggerAll = async () => {
    setTriggering(true); setTrigResult(null)
    const r = await fetch('/api/pipeline', { method: 'POST' }).then(x => x.json()).catch(e => ({ error: e.message }))
    setTrigResult(r); setTriggering(false)
    setTimeout(load, 3000)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  if (error) return (
    <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-6 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
      <p className="text-red-300 text-sm font-mono whitespace-pre-wrap">{error}</p>
      <button onClick={load} className="text-xs text-gray-400 hover:text-white underline">Retry</button>
    </div>
  )

  const p = data?.pipeline ?? {}
  const b = data?.d1_buffer ?? {}
  const sources = data?.top_sources ?? []
  const pushes  = data?.recent_pushes ?? []
  const workers = data?.worker_stats ?? []

  const mediaBreakdown = [
    { label: 'Text',  value: b.text,  color: '#a855f7' },
    { label: 'Image', value: b.image, color: '#22d3ee' },
    { label: 'Audio', value: b.audio, color: '#10b981' },
    { label: 'Video', value: b.video, color: '#f59e0b' },
  ].filter(x => (x.value ?? 0) > 0)

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold">{p.version}</h3>
          <p className="text-gray-400 text-xs mt-0.5">Live Cloudflare D1 data</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={triggerAll} disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs text-white transition-colors">
            {triggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Trigger All 20 Workers
          </button>
        </div>
      </div>

      {trigResult && (
        <div className={`rounded-xl p-3 border text-xs font-mono ${trigResult.error ? 'bg-red-900/20 border-red-700/30 text-red-300' : 'bg-green-900/20 border-green-700/30 text-green-300'}`}>
          {trigResult.error ? `Error: ${trigResult.error}` : `✓ Triggered ${trigResult.success}/${(trigResult.success||0)+(trigResult.failed||0)} workers successfully`}
        </div>
      )}

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Scraped',  value: (p.total_scraped ?? 0).toLocaleString(), icon: Database, color: 'text-cyan-400'   },
          { label: 'Pushed to HF',   value: (p.total_pushed  ?? 0).toLocaleString(), icon: Radio,    color: 'text-purple-400' },
          { label: 'D1 Buffer',      value: (b.total         ?? 0).toLocaleString(), icon: Server,   color: 'text-amber-400'  },
          { label: 'Avg Quality',    value: (b.avg_quality   ?? 0).toString(),        icon: TrendingUp, color: 'text-green-400'},
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-black text-white">{value || '0'}</p>
          </div>
        ))}
      </div>

      {/* AI vs Human + Media breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 mb-3">Label Balance (D1 buffer)</h4>
          <div className="space-y-2">
            {[
              { label: 'AI-generated', value: b.ai_items    ?? 0, total: b.total ?? 1, color: '#a855f7' },
              { label: 'Human',        value: b.human_items ?? 0, total: b.total ?? 1, color: '#22d3ee' },
            ].map(({ label, value, total, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{label}</span><span>{value.toLocaleString()} ({Math.round(value/total*100)}%)</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(value/total*100)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 mb-3">Media Type Breakdown</h4>
          {mediaBreakdown.length ? (
            <div className="space-y-2">
              {mediaBreakdown.map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{label}</span><span>{(value ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((value ?? 0)/(b.total||1)*100)}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-xs">No data yet</p>}
        </div>
      </div>

      {/* Worker activity */}
      {workers.length > 0 && (
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 mb-3">Worker Activity ({workers.length} active workers)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {workers.slice(0,20).map((w: any) => (
              <div key={w.worker_id} className="bg-gray-700/60 rounded-lg p-2">
                <p className="text-xs font-mono text-purple-300">{w.worker_id}</p>
                <p className="text-sm font-bold text-white mt-0.5">{(w.items ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">q={w.avg_q}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top sources */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400">Top Sources in Buffer</h4>
        </div>
        <div className="divide-y divide-gray-700/50 max-h-64 overflow-y-auto">
          {sources.slice(0,20).map((s: any) => (
            <div key={`${s.source_name}-${s.label}`} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${s.media_type==='text'?'bg-purple-900/50 text-purple-300':s.media_type==='image'?'bg-cyan-900/50 text-cyan-300':s.media_type==='audio'?'bg-green-900/50 text-green-300':'bg-amber-900/50 text-amber-300'}`}>{s.media_type}</span>
                <span className="text-sm text-white font-mono">{s.source_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.label==='ai'?'bg-rose-900/40 text-rose-300':'bg-emerald-900/40 text-emerald-300'}`}>{s.label}</span>
                <span className="text-sm text-gray-300 font-bold">{(s.count ?? 0).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {sources.length === 0 && <p className="text-gray-500 text-xs p-4">No data yet</p>}
        </div>
      </div>

      {/* Recent HF push log */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400">Recent HF Push Log</h4>
        </div>
        <div className="divide-y divide-gray-700/50">
          {pushes.slice(0,8).map((push: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                {push.status === 'success'
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  : <XCircle    className="w-3.5 h-3.5 text-red-400 flex-shrink-0"   />}
                <span className="text-xs text-gray-300">{push.status === 'success' ? `${push.item_count} items → HF` : (push.error?.slice(0,60) ?? 'error')}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">{push.created_at?.slice(0,16)}</span>
            </div>
          ))}
          {pushes.length === 0 && <p className="text-gray-500 text-xs p-4">No pushes yet — HF fix deployed, workers need redeployment via GitHub Actions</p>}
        </div>
      </div>

      {/* Timing */}
      <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
        <div>Last scrape: <span className="text-gray-300 font-mono">{p.last_scrape?.slice(0,16) ?? '—'}</span></div>
        <div>Last push:   <span className="text-gray-300 font-mono">{p.last_push?.slice(0,16)   ?? 'never'}</span></div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab]       = useState('overview')
  const [loggingOut, setLO] = useState(false)
  const router = useRouter()

  const logout = async () => {
    setLO(true)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    document.cookie = 'admin_session=; Max-Age=0; path=/'
    router.push('/')
  }

  const TAB_CONTENT: Record<string, React.ReactNode> = {
    overview:      <OverviewTab />,
    users:         <UsersTab />,
    subscriptions: <div className="text-gray-400 py-10 text-center">Subscriptions tab — connect Stripe to view data</div>,
    analytics:     <div className="text-gray-400 py-10 text-center">Analytics tab — scan data visualizations coming soon</div>,
    pipeline:      <PipelineTab />,
    flags:         <FlagsTab />,
    security:      <SecurityTab />,
    apikeys:       <div className="text-gray-400 py-10 text-center">API Keys tab — key management coming in next release</div>,
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-black text-sm">DETECTAI Admin</h1>
            <p className="text-xs text-gray-500">Super Admin Panel</p>
          </div>
        </div>
        <button onClick={logout} disabled={loggingOut}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50">
          {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Logout
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-52 flex-shrink-0 border-r border-gray-800 min-h-[calc(100vh-65px)] py-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                tab === id
                  ? 'bg-purple-500/10 text-purple-400 border-r-2 border-purple-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          <h2 className="text-lg font-bold text-white mb-6 capitalize">{tab}</h2>
          {TAB_CONTENT[tab]}
        </main>
      </div>
    </div>
  )
}
