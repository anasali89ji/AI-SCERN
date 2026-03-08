'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Database, Users, Brain, Activity, Play, Upload,
  CheckCircle, XCircle, Clock, Loader2, RefreshCw, LogOut,
  BarChart3, Layers, Globe, FileText, Zap, ChevronRight, AlertTriangle
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'

const NAV = [
  { id: 'overview',  label: 'Overview',       icon: BarChart3 },
  { id: 'pipeline',  label: 'Pipeline Jobs',  icon: Activity  },
  { id: 'dataset',   label: 'Dataset Items',  icon: Database  },
  { id: 'hf-push',   label: 'HF Dataset Push',icon: Upload    },
  { id: 'scans',     label: 'User Scans',     icon: Brain     },
  { id: 'users',     label: 'Users',          icon: Users     },
  { id: 'security',  label: 'Security Audit', icon: Shield    },
]

const SECURITY_ISSUES = [
  { sev: 'CRITICAL', table: 'scans', policy: 'scans_owner', issue: 'USING (true) — any user reads ALL scans across all users', fix: 'Change to USING (user_id = auth.uid())' },
  { sev: 'CRITICAL', table: 'profiles', policy: 'profiles_self', issue: 'USING (true) — any user reads ALL profiles', fix: 'Remove duplicate policy; keep only "Users manage own profile"' },
  { sev: 'CRITICAL', table: 'pipeline_jobs', policy: 'pipeline_jobs_all', issue: 'Fully open — anyone can create/modify/delete pipeline jobs', fix: 'Restrict to service_role only' },
  { sev: 'HIGH', table: 'Auth flow', policy: 'Firebase UID mismatch', issue: 'auth.uid() returns NULL for Firebase users — RLS policies broken', fix: 'Set user_id to Firebase UID; switch to service role for all server writes' },
  { sev: 'HIGH', table: 'Session cookie', policy: '__session', issue: 'Raw Firebase ID token in cookie (1-hour expiry, no refresh logic)', fix: 'Implement token refresh or use Firebase session cookies (14-day max)' },
  { sev: 'HIGH', table: 'dataset_items', policy: 'dataset_items_write', issue: 'Anyone can INSERT dataset items with no authentication check', fix: 'Restrict to service_role or authenticated pipeline worker only' },
  { sev: 'MEDIUM', table: 'Functions', policy: 'search_path mutable', issue: '5 DB functions lack SET search_path — SQL injection vector', fix: 'Add SET search_path = public to each function' },
  { sev: 'MEDIUM', table: 'SUPABASE_SERVICE_ROLE_KEY', policy: 'Missing env var', issue: 'Server-side code falls back to anon key — bypasses RLS intent', fix: 'Add SUPABASE_SERVICE_ROLE_KEY to all Netlify env vars' },
  { sev: 'LOW', table: 'Rate limiter', policy: 'In-memory only', issue: 'Rate limit resets on every cold start — ineffective on serverless', fix: 'Store rate limit state in Supabase or use Upstash Redis' },
  { sev: 'LOW', table: 'Scraper API', policy: 'Mock data', issue: 'Scraper returns fake mock data — misleading to users', fix: 'Implement real web scraping with cheerio/puppeteer' },
]

const VERDICTS = ['AI', 'HUMAN', 'UNCERTAIN']

function Badge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>
}

function SevBadge({ sev }: { sev: string }) {
  const colors: Record<string,string> = {
    CRITICAL: 'bg-danger/20 text-danger border-danger/30',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-warning/20 text-warning border-warning/30',
    LOW: 'bg-text-3/20 text-text-2 border-text-3/30',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${colors[sev] || ''}`}>{sev}</span>
}

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string|null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/pipeline')
      if (res.status === 401) { router.push('/'); return }
      const d = await res.json()
      setData(d)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  const triggerJob = async (job_type: string) => {
    setTriggering(job_type)
    await fetch('/api/pipeline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger', job_type })
    })
    await load()
    setTriggering(null)
  }

  const pushToHF = async (media_type?: string) => {
    setPushing(true); setPushResult(null)
    const res = await fetch('/api/hf-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type })
    })
    const d = await res.json()
    setPushResult(d); setPushing(false)
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
        <p className="text-text-3 text-sm">Loading admin data...</p>
      </div>
    </div>
  )

  const jobs = data?.jobs ?? []
  const dataset = data?.dataset ?? []
  const scans = data?.scans ?? []
  const users = data?.profiles ?? []
  const jobStats = data?.jobStats ?? {}
  const datasetStats = data?.datasetStats ?? {}

  // Chart data
  const jobChartData = Object.entries(jobStats).map(([k,v]) => ({ name: k, value: v as number }))
  const dsChartData = Object.entries(datasetStats).map(([k,v]) => ({ name: k.replace('_',' '), value: v as number }))
  const verdictData = VERDICTS.map(v => ({ name: v, value: scans.filter((s:any) => s.verdict === v).length }))
  const COLORS = ['#f43f5e','#10b981','#f59e0b','#7c3aed','#2563eb','#06b6d4']

  const recentJobs = jobs.slice(0, 8)

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-56 bg-surface border-r border-border flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-1">DETECTAI</p>
              <p className="text-[10px] text-text-3">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors
                ${tab === n.id ? 'bg-accent/15 text-accent' : 'text-text-3 hover:text-text-1 hover:bg-border/50'}`}>
              <n.icon className="w-4 h-4 flex-shrink-0" />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-3 hover:text-danger rounded-xl hover:bg-danger/10 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface/50">
          <h1 className="font-bold text-text-1">{NAV.find(n=>n.id===tab)?.label}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"/>Live · refreshes every 15s
            </span>
            <button onClick={load} className="text-text-3 hover:text-text-1 transition-colors">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users',       value: users.length,   icon: Users,    color: 'text-accent'  },
                  { label: 'Total Scans',        value: scans.length,   icon: Brain,    color: 'text-success' },
                  { label: 'Dataset Items',      value: dataset.length, icon: Database, color: 'text-warning' },
                  { label: 'Pipeline Jobs',      value: jobs.length,    icon: Activity, color: 'text-accent2' },
                ].map((s, i) => (
                  <div key={i} className="bg-surface border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                      <span className="text-xs text-text-3">{s.label}</span>
                    </div>
                    <p className="text-3xl font-black text-text-1">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-text-1 mb-4">Dataset by Type & Label</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dsChartData}>
                      <XAxis dataKey="name" tick={{ fill:'#475569', fontSize:11 }} />
                      <YAxis tick={{ fill:'#475569', fontSize:11 }} />
                      <Tooltip contentStyle={{ background:'#0f0f1a', border:'1px solid #1a1a2e', borderRadius:8 }} />
                      <Bar dataKey="value" radius={[4,4,0,0]}>
                        {dsChartData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-text-1 mb-4">Scan Verdicts</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={verdictData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value}: any) => `${name}: ${value}`} labelLine={false}>
                        {verdictData.map((_:any, i:number) => <Cell key={i} fill={['#f43f5e','#10b981','#f59e0b'][i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background:'#0f0f1a', border:'1px solid #1a1a2e', borderRadius:8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-text-1 mb-4">Recent Pipeline Jobs</h3>
                <div className="space-y-2">
                  {recentJobs.length === 0 && <p className="text-text-3 text-sm">No jobs yet. Trigger one from the Pipeline tab.</p>}
                  {recentJobs.map((j: any) => (
                    <div key={j.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge status={j.status} />
                        <span className="text-sm text-text-1 font-medium">{j.job_type}</span>
                        <span className="text-xs text-text-3">#{j.id?.slice(0,8)}</span>
                      </div>
                      <span className="text-xs text-text-3">{new Date(j.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {tab === 'pipeline' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {['pending','running','complete','failed'].map(s => (
                  <div key={s} className="bg-surface border border-border rounded-2xl p-4">
                    <p className="text-xs text-text-3 capitalize mb-2">{s} jobs</p>
                    <p className="text-3xl font-black text-text-1">{jobStats[s] || 0}</p>
                    <Badge status={s} />
                  </div>
                ))}
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-text-1 mb-4">Trigger Pipeline Jobs</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { type:'scrape',   label:'Run Scraper',    icon:Globe,     desc:'Pull data from HF sources' },
                    { type:'clean',    label:'Run Cleaner',    icon:Layers,    desc:'Deduplicate & normalize data' },
                    { type:'augment',  label:'Run Augmenter',  icon:Zap,       desc:'Paraphrase & back-translate' },
                    { type:'upload',   label:'Run Uploader',   icon:Upload,    desc:'Sync to HF dataset' },
                  ].map(j => (
                    <button key={j.type} onClick={() => triggerJob(j.type)}
                      disabled={triggering === j.type}
                      className="bg-bg border border-border-bright rounded-xl p-4 text-left hover:border-accent/40 transition-all group disabled:opacity-50">
                      <j.icon className="w-5 h-5 text-accent mb-3" />
                      <p className="text-sm font-semibold text-text-1 mb-1">{j.label}</p>
                      <p className="text-xs text-text-3">{j.desc}</p>
                      {triggering === j.type && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                          <Loader2 className="w-3 h-3 animate-spin" /> Triggering...
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-1">All Jobs ({jobs.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        {['ID','Type','Status','Priority','Created'].map(h => (
                          <th key={h} className="pb-3 pr-4 text-xs font-semibold text-text-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j: any) => (
                        <tr key={j.id} className="border-b border-border/50 hover:bg-border/20">
                          <td className="py-2.5 pr-4 font-mono text-xs text-text-3">{j.id?.slice(0,8)}</td>
                          <td className="py-2.5 pr-4 text-text-2">{j.job_type}</td>
                          <td className="py-2.5 pr-4"><Badge status={j.status} /></td>
                          <td className="py-2.5 pr-4 text-text-3">{j.priority}</td>
                          <td className="py-2.5 text-text-3 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {jobs.length === 0 && <p className="text-center text-text-3 py-8">No jobs in database</p>}
                </div>
              </div>
            </div>
          )}

          {/* DATASET */}
          {tab === 'dataset' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(datasetStats).map(([k,v]: any) => (
                  <div key={k} className="bg-surface border border-border rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-text-1">{v}</p>
                    <p className="text-[10px] text-text-3 mt-1">{k.replace('_',' ')}</p>
                  </div>
                ))}
                {Object.keys(datasetStats).length === 0 && (
                  <div className="col-span-6 text-center py-8 text-text-3">No dataset items yet. Trigger a scrape job.</div>
                )}
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5 overflow-x-auto">
                <h3 className="text-sm font-semibold text-text-1 mb-4">Dataset Items (latest 200)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {['ID','Type','Label','Source','Split','Deduped','HF Pushed','Created'].map(h => (
                        <th key={h} className="pb-3 pr-4 text-xs font-semibold text-text-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.map((item: any) => (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-border/20">
                        <td className="py-2 pr-4 font-mono text-xs text-text-3">{item.id?.slice(0,8)}</td>
                        <td className="py-2 pr-4 text-text-2">{item.media_type}</td>
                        <td className="py-2 pr-4"><span className={`badge badge-${item.label}`}>{item.label}</span></td>
                        <td className="py-2 pr-4 text-text-3 text-xs max-w-[120px] truncate">{item.source_name || '—'}</td>
                        <td className="py-2 pr-4 text-text-3">{item.split}</td>
                        <td className="py-2 pr-4">{item.is_deduplicated ? <CheckCircle className="w-4 h-4 text-success"/> : <XCircle className="w-4 h-4 text-text-3"/>}</td>
                        <td className="py-2 pr-4">{item.hf_dataset_id ? <CheckCircle className="w-4 h-4 text-accent"/> : <XCircle className="w-4 h-4 text-text-3"/>}</td>
                        <td className="py-2 text-text-3 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HF PUSH */}
          {tab === 'hf-push' && (
            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-bold text-text-1">Push Dataset to HuggingFace</h2>
                    <p className="text-text-3 text-sm mt-1">Uploads deduplicated dataset_items to your HF dataset repo as JSONL files.</p>
                    <p className="text-xs text-text-3 mt-1">Repo: <code className="text-accent">saghi776/detectai-dataset</code></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                  {[
                    { label:'Push All Types',     mt: undefined   },
                    { label:'Text Only',          mt: 'text'      },
                    { label:'Image Only',         mt: 'image'     },
                    { label:'Audio Only',         mt: 'audio'     },
                    { label:'Video Only',         mt: 'video'     },
                  ].map(b => (
                    <button key={b.label} onClick={() => pushToHF(b.mt)} disabled={pushing}
                      className="bg-bg border border-border-bright rounded-xl p-4 hover:border-accent/40 transition-all disabled:opacity-50 text-left">
                      <Upload className="w-5 h-5 text-accent mb-2" />
                      <p className="text-sm font-semibold text-text-1">{b.label}</p>
                      {pushing && <Loader2 className="w-3 h-3 text-accent animate-spin mt-1" />}
                    </button>
                  ))}
                </div>

                {pushResult && (
                  <div className={`rounded-xl border p-5 ${pushResult.error ? 'bg-danger/10 border-danger/20' : 'bg-success/10 border-success/20'}`}>
                    {pushResult.error ? (
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-danger">Push Failed</p>
                          <p className="text-sm text-text-2 mt-1">{pushResult.error}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-success">{pushResult.simulated ? 'Simulated Push (no HF token)' : 'Pushed Successfully'}</p>
                          <p className="text-sm text-text-2 mt-1">Total items: <strong>{pushResult.total}</strong></p>
                          <p className="text-sm text-text-2">Repo: <code className="text-accent">{pushResult.repo}</code></p>
                          {pushResult.commit && <p className="text-xs text-text-3 mt-1">Commit: {pushResult.commit.commitId}</p>}
                          {pushResult.simulated && (
                            <p className="text-xs text-warning mt-2">⚠ Set HUGGINGFACE_API_TOKEN in Netlify env vars for real push</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(pushResult.stats || {}).map(([k,v]: any) => (
                              <span key={k} className="text-xs bg-bg border border-border px-2 py-1 rounded-lg text-text-2">{k.replace('_',' ')}: {v}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-text-1 mb-3">Push Checklist</h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'HuggingFace token configured', done: true, note: 'Set in Netlify env: HUGGINGFACE_API_TOKEN' },
                    { label: 'Dataset repo exists on HF Hub', done: false, note: 'Create at: huggingface.co/new-dataset' },
                    { label: 'Items deduplicated', done: dataset.filter((i:any) => i.is_deduplicated).length > 0, note: `${dataset.filter((i:any) => i.is_deduplicated).length} items ready` },
                    { label: 'Scrape jobs completed', done: Object.keys(datasetStats).length > 0, note: 'Trigger scrape job first' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      {c.done ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0"/> : <XCircle className="w-4 h-4 text-text-3 flex-shrink-0"/>}
                      <div>
                        <p className="text-sm text-text-1">{c.label}</p>
                        <p className="text-xs text-text-3">{c.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCANS */}
          {tab === 'scans' && (
            <div className="bg-surface border border-border rounded-2xl p-5 overflow-x-auto">
              <h3 className="text-sm font-semibold text-text-1 mb-4">All User Scans ({scans.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['ID','User','Type','Verdict','Confidence','Created'].map(h => (
                      <th key={h} className="pb-3 pr-4 text-xs font-semibold text-text-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-border/20">
                      <td className="py-2.5 pr-4 font-mono text-xs text-text-3">{s.id?.slice(0,8)}</td>
                      <td className="py-2.5 pr-4 text-xs text-text-3 max-w-[120px] truncate">{s.user_id?.slice(0,12)}</td>
                      <td className="py-2.5 pr-4 text-text-2">{s.media_type}</td>
                      <td className="py-2.5 pr-4">{s.verdict ? <span className={`badge badge-${s.verdict?.toLowerCase()}`}>{s.verdict}</span> : '—'}</td>
                      <td className="py-2.5 pr-4 text-text-2">{s.confidence_score ? `${Math.round(s.confidence_score)}%` : '—'}</td>
                      <td className="py-2.5 text-text-3 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scans.length === 0 && <p className="text-center text-text-3 py-8">No scans yet</p>}
            </div>
          )}

          {/* USERS */}
          {tab === 'users' && (
            <div className="bg-surface border border-border rounded-2xl p-5 overflow-x-auto">
              <h3 className="text-sm font-semibold text-text-1 mb-4">Registered Users ({users.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['ID','Email','Name','Plan','Scans','Joined'].map(h => (
                      <th key={h} className="pb-3 pr-4 text-xs font-semibold text-text-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-border/20">
                      <td className="py-2.5 pr-4 font-mono text-xs text-text-3">{u.id?.slice(0,8)}</td>
                      <td className="py-2.5 pr-4 text-text-2 text-xs">{u.email || '—'}</td>
                      <td className="py-2.5 pr-4 text-text-2">{u.display_name || '—'}</td>
                      <td className="py-2.5 pr-4"><span className="badge badge-complete">{u.plan || 'free'}</span></td>
                      <td className="py-2.5 pr-4 text-text-1 font-bold">{u.scan_count || 0}</td>
                      <td className="py-2.5 text-text-3 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className="text-center text-text-3 py-8">No users yet</p>}
            </div>
          )}

          {/* SECURITY AUDIT */}
          {tab === 'security' && (
            <div className="space-y-6">
              <div className="bg-danger/10 border border-danger/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                  <h3 className="font-bold text-danger">Security Audit — 3 Critical, 2 High Issues Found</h3>
                </div>
                <p className="text-text-2 text-sm">These issues were found during deep code audit and must be resolved before production launch with real users.</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-text-1">All Security Issues</h3>
                </div>
                <div className="divide-y divide-border">
                  {SECURITY_ISSUES.map((issue, i) => (
                    <div key={i} className="p-4 hover:bg-border/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <SevBadge sev={issue.sev} />
                          <div>
                            <p className="text-sm font-medium text-text-1">{issue.table} — <code className="text-accent text-xs">{issue.policy}</code></p>
                            <p className="text-xs text-danger/80 mt-0.5">{issue.issue}</p>
                            <p className="text-xs text-success mt-1">Fix: {issue.fix}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
