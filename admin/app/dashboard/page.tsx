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

// ── Pipeline Tab (existing, secured) ─────────────────────────────────────────
function PipelineTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pipeline-stats').then(r => r.json()).then(d => { setStats(d); setLoading(false) })
    .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Scraped',   value: stats.totalScraped?.toLocaleString(),  icon: Database, color: 'text-cyan-400'   },
            { label: 'Pushed to HF',    value: stats.totalPushed?.toLocaleString(),   icon: Radio,    color: 'text-purple-400' },
            { label: 'Pending',         value: stats.pendingItems?.toLocaleString(),  icon: Server,   color: 'text-amber-400'  },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
              <p className="text-2xl font-black text-white">{value || '—'}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/60 rounded-xl p-8 border border-gray-700 text-center text-gray-400">
          Pipeline stats unavailable. Check CLOUDFLARE_API_TOKEN env var.
        </div>
      )}
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
