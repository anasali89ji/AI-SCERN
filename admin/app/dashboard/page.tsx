'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Shield, Activity, LogOut, RefreshCw, Loader2, Users, CreditCard,
  BarChart3, Database, Flag, CheckCircle, TrendingUp,
  AlertTriangle, Play, Zap, Ban, Radio,
  Settings, Clock, Globe, AlertCircle, Download, Search,
  ChevronDown, ChevronUp, Trash2, Plus, Save, X
} from 'lucide-react'

const PLAN_COLORS: Record<string,string> = { free:'#6b7280', starter:'#3b82f6', pro:'#8b5cf6', enterprise:'#f59e0b' }
const VERDICT_COLORS: Record<string,string> = { AI:'#f87171', HUMAN:'#34d399', UNCERTAIN:'#fbbf24' }
const TOOL_COLORS: Record<string,string> = { text:'#a78bfa', image:'#60a5fa', audio:'#34d399', video:'#fb923c' }

interface User { id: string; email: string; display_name: string; plan_id: string; credits_remaining: number; scan_count: number; created_at: string; is_banned: boolean }
interface FeatureFlag { id?: string; key: string; enabled: boolean; rollout_percentage: number; description?: string }
interface ErrorLog { id: number; service: string; message: string; stack_trace?: string; resolved: boolean; created_at: string; error_code?: string }
interface AuditLog { id: number; action_type: string; admin_id?: string; target_resource?: string; ip_address?: string; metadata?: Record<string,unknown>; created_at: string; admin_users?: { email: string } }
interface Setting { key: string; value: string; description?: string }

async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return r.json()
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-800/60 rounded-xl border border-gray-700/60 p-5 ${className}`}>{children}</div>
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const cls: Record<string,string> = {
    green:'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    red:'bg-red-900/40 text-red-300 border-red-700/40',
    yellow:'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    blue:'bg-blue-900/40 text-blue-300 border-blue-700/40',
    purple:'bg-purple-900/40 text-purple-300 border-purple-700/40',
    gray:'bg-gray-700/60 text-gray-400 border-gray-600/40',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls[color]||cls.gray}`}>{children}</span>
}

function Stat({ label, value, icon: Icon, color='text-white' }: { label:string; value:string|number; icon?:any; color?:string }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-black ${color}`}>{value}</p>
        </div>
        {Icon && <Icon className="w-5 h-5 text-gray-600 mt-1" />}
      </div>
    </div>
  )
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData]       = useState<Record<string,unknown>|null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('7d')
  const load = useCallback(() => { setLoading(true); api(`/analytics?period=${period}`).then(d => { setData(d); setLoading(false) }) }, [period])
  useEffect(load, [load])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
  if (!data) return <div className="text-gray-500 text-center py-16">Failed to load</div>

  const kpis = data.kpis as any || {}
  const dailyScans = data.dailyScans as any[] || []
  const dailyUsers = data.dailyUsers as any[] || []
  const planDist   = data.planDistribution as any[] || []
  const verdictDist= data.verdictDistribution as any[] || []
  const toolUsage  = data.toolUsage as any[] || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {(['7d','30d','90d'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${period===p?'bg-purple-600 text-white':'bg-gray-700/60 text-gray-400 hover:text-white'}`}>
            {p==='7d'?'7 days':p==='30d'?'30 days':'90 days'}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 rounded-lg bg-gray-700/60 text-gray-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Total Scans"  value={(kpis.totalScans||0).toLocaleString()} icon={Activity}   color="text-purple-300" />
        <Stat label="Total Users"  value={(kpis.totalUsers||0).toLocaleString()} icon={Users}      color="text-blue-300" />
        <Stat label="Paid Users"   value={(kpis.paidUsers||0).toLocaleString()}  icon={CreditCard} color="text-emerald-300" />
        <Stat label="Conversion"   value={`${kpis.convRate||0}%`}                icon={TrendingUp} color="text-amber-300" />
        <Stat label="Scans/User"   value={kpis.avgScansUser||0}                  icon={BarChart3}  color="text-pink-300" />
      </div>
      <Card>
        <p className="text-white font-semibold mb-4">Daily Scan Volume</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyScans}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.4}/><stop offset="95%" stopColor="#f87171" stopOpacity={0}/></linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.4}/><stop offset="95%" stopColor="#34d399" stopOpacity={0}/></linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{fontSize:11,fill:'#6b7280'}} tickFormatter={(d:string)=>d.slice(5)} />
            <YAxis tick={{fontSize:11,fill:'#6b7280'}} />
            <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8,fontSize:12}} />
            <Area type="monotone" dataKey="ai"    stroke="#f87171" fill="url(#g1)" name="AI"    strokeWidth={2} />
            <Area type="monotone" dataKey="human" stroke="#34d399" fill="url(#g2)" name="Human" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <p className="text-white font-semibold mb-4">Tool Usage</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={toolUsage} layout="vertical">
              <XAxis type="number" tick={{fontSize:11,fill:'#6b7280'}} />
              <YAxis type="category" dataKey="tool" tick={{fontSize:11,fill:'#6b7280'}} width={50} />
              <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8,fontSize:12}} />
              <Bar dataKey="count" radius={[0,6,6,0]}>
                {toolUsage.map((e:any,i:number)=><Cell key={i} fill={TOOL_COLORS[e.tool]||'#8b5cf6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p className="text-white font-semibold mb-4">Plan Distribution</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={planDist} dataKey="count" nameKey="plan" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                  {planDist.map((e:any,i:number)=><Cell key={i} fill={PLAN_COLORS[e.plan]||'#8b5cf6'} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8,fontSize:12}} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {planDist.map((p:any,i:number)=>(
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full" style={{background:PLAN_COLORS[p.plan]||'#8b5cf6'}} />
                  <span className="text-gray-400 capitalize w-20">{p.plan}</span>
                  <span className="text-white font-bold">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-white font-semibold mb-4">New Users per Day</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dailyUsers}>
              <XAxis dataKey="date" tick={{fontSize:11,fill:'#6b7280'}} tickFormatter={(d:string)=>d.slice(5)} />
              <YAxis tick={{fontSize:11,fill:'#6b7280'}} />
              <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8,fontSize:12}} />
              <Line type="monotone" dataKey="new_users" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p className="text-white font-semibold mb-4">Verdict Breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={verdictDist}>
              <XAxis dataKey="verdict" tick={{fontSize:11,fill:'#6b7280'}} />
              <YAxis tick={{fontSize:11,fill:'#6b7280'}} />
              <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8,fontSize:12}} />
              <Bar dataKey="count" radius={[6,6,0,0]}>
                {verdictDist.map((e:any,i:number)=><Cell key={i} fill={VERDICT_COLORS[e.verdict]||'#8b5cf6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users,setUsers]=useState<User[]>([])
  const [total,setTotal]=useState(0)
  const [page,setPage]=useState(1)
  const [q,setQ]=useState('')
  const [plan,setPlan]=useState('')
  const [loading,setLoading]=useState(true)
  const [acting,setActing]=useState<string|null>(null)

  const load=useCallback(()=>{setLoading(true);api(`/users?q=${encodeURIComponent(q)}&plan=${plan}&page=${page}`).then(d=>{setUsers(d.users||[]);setTotal(d.total||0);setLoading(false)})},[q,plan,page])
  useEffect(load,[load])

  const ban=async(id:string,banned:boolean)=>{setActing(id);await api(`/users/${id}/ban`,'POST',{ban:!banned});load();setActing(null)}
  const setPlanFn=async(id:string,p:string)=>{setActing(id);await api(`/users/${id}/plan`,'POST',{plan:p});load();setActing(null)}

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search email or name…" className="w-full pl-9 pr-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none" />
        </div>
        <select value={plan} onChange={e=>{setPlan(e.target.value);setPage(1)}} className="px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-sm text-white focus:outline-none">
          <option value="">All plans</option>
          {['free','starter','pro','enterprise'].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={load} className="p-2.5 bg-gray-700/60 rounded-lg text-gray-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="text-xs text-gray-500">{total.toLocaleString()} users</div>
      {loading?<div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-purple-400" /></div>:(
        <div className="bg-gray-800/60 rounded-xl border border-gray-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-700 bg-gray-800/80">
                {['User','Plan','Credits','Scans','Joined','Status','Actions'].map(h=>(
                  <th key={h} className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-700/50">
                {users.map(u=>(
                  <tr key={u.id} className={`hover:bg-gray-700/30 transition-colors ${u.is_banned?'opacity-60':''}`}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white truncate max-w-[140px]">{u.display_name||u.email?.split('@')[0]||'—'}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[160px]">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <select value={u.plan_id||'free'} onChange={e=>setPlanFn(u.id,e.target.value)} disabled={acting===u.id}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white">
                        {['free','starter','pro','enterprise'].map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-300 tabular-nums">{u.credits_remaining??'—'}</td>
                    <td className="py-3 px-4 text-gray-300 tabular-nums">{u.scan_count??0}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{u.created_at?.slice(0,10)}</td>
                    <td className="py-3 px-4"><Badge color={u.is_banned?'red':'green'}>{u.is_banned?'Banned':'Active'}</Badge></td>
                    <td className="py-3 px-4">
                      <button onClick={()=>ban(u.id,u.is_banned)} disabled={acting===u.id}
                        className={`p-1.5 rounded-lg transition-colors ${u.is_banned?'text-emerald-400 hover:bg-emerald-900/20':'text-red-400 hover:bg-red-900/20'}`}>
                        {acting===u.id?<Loader2 className="w-4 h-4 animate-spin"/>:u.is_banned?<CheckCircle className="w-4 h-4"/>:<Ban className="w-4 h-4"/>}
                      </button>
                    </td>
                  </tr>
                ))}
                {!users.length&&<tr><td colSpan={7} className="py-12 text-center text-gray-600">No users found</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
            <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total/20)||1}</span>
            <div className="flex gap-2">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 text-xs rounded-lg bg-gray-700/60 text-gray-400 disabled:opacity-40">Prev</button>
              <button onClick={()=>setPage(p=>p+1)} disabled={users.length<20} className="px-3 py-1.5 text-xs rounded-lg bg-gray-700/60 text-gray-400 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Feature Flags ─────────────────────────────────────────────────────────────
function FlagsTab() {
  const [flags,setFlags]=useState<FeatureFlag[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState<string|null>(null)
  const [nf,setNf]=useState({key:'',description:'',rollout_percentage:100})
  const [creating,setCreating]=useState(false)
  const [showNew,setShowNew]=useState(false)

  const load=()=>{setLoading(true);api('/feature-flags').then(d=>{setFlags(d.flags||[]);setLoading(false)})}
  useEffect(load,[])

  const toggle=async(key:string,enabled:boolean)=>{setSaving(key);await api(`/feature-flags/${key}`,'POST',{enabled:!enabled});setFlags(p=>p.map(f=>f.key===key?{...f,enabled:!enabled}:f));setSaving(null)}
  const updateRollout=async(key:string,pct:number)=>{setSaving(key);await api(`/feature-flags/${key}`,'POST',{rollout_percentage:pct});setFlags(p=>p.map(f=>f.key===key?{...f,rollout_percentage:pct}:f));setSaving(null)}
  const deleteFlag=async(key:string)=>{if(!confirm(`Delete "${key}"?`))return;setSaving(key);await api(`/feature-flags/${key}`,'DELETE');setFlags(p=>p.filter(f=>f.key!==key));setSaving(null)}
  const createFlag=async()=>{if(!nf.key.trim())return;setCreating(true);await api('/feature-flags','POST',{...nf,enabled:false});setNf({key:'',description:'',rollout_percentage:100});setShowNew(false);load();setCreating(false)}

  if(loading)return<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-white font-bold text-lg">Feature Flags</h3><p className="text-gray-500 text-sm">{flags.length} flags</p></div>
        <button onClick={()=>setShowNew(s=>!s)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4"/>New Flag</button>
      </div>
      {showNew&&(
        <Card className="border-purple-700/40">
          <h4 className="text-white font-semibold mb-3">Create New Flag</h4>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <input value={nf.key} onChange={e=>setNf(p=>({...p,key:e.target.value.toLowerCase().replace(/\s+/g,'-')}))} placeholder="flag-key" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none"/>
            <input value={nf.description} onChange={e=>setNf(p=>({...p,description:e.target.value}))} placeholder="Description…" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none"/>
            <input type="number" min={0} max={100} value={nf.rollout_percentage} onChange={e=>setNf(p=>({...p,rollout_percentage:+e.target.value}))} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none"/>
          </div>
          <div className="flex gap-2">
            <button onClick={createFlag} disabled={creating||!nf.key} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2">{creating?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Create</button>
            <button onClick={()=>setShowNew(false)} className="px-4 py-2 bg-gray-700 text-gray-400 rounded-lg text-sm">Cancel</button>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {!flags.length&&<div className="text-center py-12 text-gray-600"><Flag className="w-8 h-8 mx-auto mb-2 opacity-40"/><p>No feature flags yet</p></div>}
        {flags.map(f=>(
          <div key={f.key} className="bg-gray-800/60 rounded-xl border border-gray-700/60 p-4 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><code className="text-purple-300 text-sm font-mono">{f.key}</code><Badge color={f.enabled?'green':'gray'}>{f.enabled?'On':'Off'}</Badge></div>
              {f.description&&<p className="text-xs text-gray-500 mt-0.5">{f.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Rollout</span>
              <input type="range" min={0} max={100} value={f.rollout_percentage} onChange={e=>updateRollout(f.key,+e.target.value)} className="w-24 accent-purple-500"/>
              <span className="text-xs text-gray-300 w-8 tabular-nums">{f.rollout_percentage}%</span>
              <button onClick={()=>toggle(f.key,f.enabled)} disabled={saving===f.key} className={`relative w-11 h-6 rounded-full transition-colors ${f.enabled?'bg-purple-600':'bg-gray-600'} disabled:opacity-50`}>
                {saving===f.key?<Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin text-white"/>:<span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${f.enabled?'translate-x-5':'translate-x-0'}`}/>}
              </button>
              <button onClick={()=>deleteFlag(f.key)} className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Errors ────────────────────────────────────────────────────────────────────
function ErrorsTab() {
  const [errors,setErrors]=useState<ErrorLog[]>([])
  const [loading,setLoading]=useState(true)
  const [service,setService]=useState('all')
  const [expanded,setExpanded]=useState<number|null>(null)
  const load=useCallback(()=>{setLoading(true);const q=service!=='all'?`?service=${service}&resolved=false`:'?resolved=false';api(`/errors${q}`).then(d=>{setErrors(d.errors||[]);setLoading(false)})},[service])
  useEffect(load,[load])
  const resolve=async(id:number)=>{await api('/errors','PATCH',{id});setErrors(p=>p.filter(e=>e.id!==id))}

  if(loading)return<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>
  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h3 className="text-white font-bold text-lg">Error Monitor</h3><p className="text-gray-500 text-sm">{errors.length} unresolved</p></div>
        <div className="flex gap-2">
          <select value={service} onChange={e=>setService(e.target.value)} className="px-3 py-1.5 bg-gray-700/60 border border-gray-600 rounded-lg text-sm text-white focus:outline-none">
            <option value="all">All services</option>
            {['api','scraper','worker','inference','auth'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={load} className="p-2 bg-gray-700/60 rounded-lg text-gray-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4"/></button>
        </div>
      </div>
      {!errors.length?(
        <Card className="text-center py-12">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3"/>
          <p className="text-emerald-300 font-semibold">No unresolved errors</p>
        </Card>
      ):(
        <div className="space-y-2">
          {errors.map(err=>(
            <div key={err.id} className="bg-gray-800/60 rounded-xl border border-red-800/30">
              <div className="flex items-start gap-3 p-4">
                <Badge color={err.service==='inference'||err.service==='auth'?'red':'yellow'}>{err.service}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {err.error_code&&<code className="text-xs text-gray-500 font-mono">{err.error_code}</code>}
                    <span className="text-xs text-gray-600">{err.created_at?.slice(0,16)}</span>
                  </div>
                  <p className="text-sm text-white">{err.message}</p>
                  {expanded===err.id&&err.stack_trace&&<pre className="mt-3 text-xs text-gray-400 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-40 font-mono">{err.stack_trace.slice(0,1500)}</pre>}
                  {err.stack_trace&&<button onClick={()=>setExpanded(expanded===err.id?null:err.id)} className="mt-2 text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors">{expanded===err.id?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}{expanded===err.id?'Hide':'Show'} stack trace</button>}
                </div>
                <button onClick={()=>resolve(err.id)} className="shrink-0 px-3 py-1.5 text-xs bg-emerald-700/20 text-emerald-400 rounded-lg hover:bg-emerald-700/40 transition-colors flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5"/>Resolve</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsTab() {
  const [settings,setSettings]=useState<Setting[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState<string|null>(null)
  const [saved,setSaved]=useState<string|null>(null)
  useEffect(()=>{api('/settings').then(d=>{setSettings(d.settings||[]);setLoading(false)})},[])
  const save=async(key:string,value:string)=>{setSaving(key);await api('/settings','PATCH',{key,value});setSaved(key);setTimeout(()=>setSaved(null),2000);setSaving(null)}

  if(loading)return<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>
  const boolKeys=settings.filter(s=>s.value==='true'||s.value==='false')
  const numKeys=settings.filter(s=>!isNaN(Number(s.value))&&s.value!=='true'&&s.value!=='false')
  return(
    <div className="space-y-6">
      <Card>
        <p className="text-white font-bold mb-4">Platform Toggles</p>
        <div className="divide-y divide-gray-700/50">
          {boolKeys.map(s=>{const on=s.value==='true';return(
            <div key={s.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div><p className="text-sm font-medium text-white capitalize">{s.key.replace(/_/g,' ')}</p>{s.description&&<p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}</div>
              <div className="flex items-center gap-3">
                {saved===s.key&&<span className="text-xs text-emerald-400">Saved</span>}
                {saving===s.key?<Loader2 className="w-5 h-5 animate-spin text-gray-400"/>:(
                  <button onClick={()=>save(s.key,on?'false':'true')} className={`relative w-12 h-6 rounded-full transition-colors ${on?'bg-purple-600':'bg-gray-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on?'translate-x-6':'translate-x-0'}`}/>
                  </button>
                )}
              </div>
            </div>
          )})}
        </div>
      </Card>
      <Card>
        <p className="text-white font-bold mb-4">Limits & Thresholds</p>
        <div className="grid md:grid-cols-2 gap-4">
          {numKeys.map(s=>(
            <div key={s.key}>
              <label className="block text-sm font-medium text-white capitalize mb-1.5">{s.key.replace(/_/g,' ')}</label>
              {s.description&&<p className="text-xs text-gray-500 mb-2">{s.description}</p>}
              <div className="flex gap-2">
                <input type="number" defaultValue={s.value} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none" onBlur={async(e)=>{if(e.target.value!==s.value)await save(s.key,e.target.value)}}/>
                {saved===s.key&&<span className="self-center text-xs text-emerald-400">✓</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
function AuditTab() {
  const [logs,setLogs]=useState<AuditLog[]>([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('')
  const [expanded,setExpanded]=useState<number|null>(null)
  useEffect(()=>{api('/activity-logs').then(d=>{setLogs(d.logs||[]);setLoading(false)})},[])
  const exportCSV=()=>{
    const rows=[['Time','Admin','Action','Resource','IP'],...logs.map(l=>[l.created_at?.slice(0,16),l.admin_users?.email||l.admin_id||'—',l.action_type,l.target_resource||'—',l.ip_address||'—'])]
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`audit-${Date.now()}.csv`;a.click()
  }
  const filtered=filter?logs.filter(l=>l.action_type.includes(filter)||l.admin_users?.email?.includes(filter)||l.target_resource?.includes(filter)):logs
  if(loading)return<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>
  return(
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter logs…" className="w-full pl-9 pr-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none"/></div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"><Download className="w-4 h-4"/>Export CSV</button>
      </div>
      <div className="text-xs text-gray-500">{filtered.length} entries</div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800 z-10"><tr className="border-b border-gray-700">
              {['Time','Admin','Action','Resource','IP',''].map((h,i)=><th key={i} className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-700/50">
              {filtered.map(log=>(
                <>
                  <tr key={log.id} className="hover:bg-gray-700/20 cursor-pointer" onClick={()=>setExpanded(expanded===log.id?null:log.id)}>
                    <td className="py-2.5 px-4 text-gray-400 text-xs font-mono whitespace-nowrap">{log.created_at?.slice(0,16)}</td>
                    <td className="py-2.5 px-4 text-gray-300 text-xs">{log.admin_users?.email||log.admin_id?.slice(0,8)||'system'}</td>
                    <td className="py-2.5 px-4"><Badge color="purple">{log.action_type}</Badge></td>
                    <td className="py-2.5 px-4 text-gray-400 text-xs">{log.target_resource||'—'}</td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs font-mono">{log.ip_address||'—'}</td>
                    <td className="py-2.5 px-4">{log.metadata&&Object.keys(log.metadata).length>0&&(expanded===log.id?<ChevronUp className="w-4 h-4 text-gray-600"/>:<ChevronDown className="w-4 h-4 text-gray-600"/>)}</td>
                  </tr>
                  {expanded===log.id&&log.metadata&&(
                    <tr key={`${log.id}-d`}><td colSpan={6} className="px-4 pb-3 bg-gray-800/40">
                      <pre className="text-xs text-gray-400 font-mono bg-black/20 rounded p-3 overflow-x-auto">{JSON.stringify(log.metadata,null,2)}</pre>
                    </td></tr>
                  )}
                </>
              ))}
              {!filtered.length&&<tr><td colSpan={6} className="py-10 text-center text-gray-600">No audit logs</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
function PipelineTab() {
  const [stats,setStats]=useState<Record<string,unknown>|null>(null)
  const [loading,setLoading]=useState(true)
  const [triggering,setTriggering]=useState(false)
  const [calRunning,setCalRunning]=useState(false)
  const [calMsg,setCalMsg]=useState<string|null>(null)
  const load=()=>{setLoading(true);api('/pipeline').then(d=>{setStats(d);setLoading(false)})}
  useEffect(load,[])
  const trigger=async()=>{setTriggering(true);await api('/pipeline','POST');setTimeout(()=>{setTriggering(false);load()},3000)}
  const runCal=async()=>{
    setCalRunning(true);setCalMsg(null)
    try{
      const [a,r]=await Promise.all([
        fetch('https://detectai-cal-ai.saghirahmed9067.workers.dev/run',{method:'POST',signal:AbortSignal.timeout(90000)}),
        fetch('https://detectai-cal-real.saghirahmed9067.workers.dev/run',{method:'POST',signal:AbortSignal.timeout(90000)}),
      ])
      const ad=await a.json().catch(()=>({})) as {inserted?:number}
      const rd=await r.json().catch(()=>({})) as {inserted?:number}
      await fetch('https://detectai-cal-agg.saghirahmed9067.workers.dev/run',{method:'POST',signal:AbortSignal.timeout(30000)})
      setCalMsg(`✓ Calibration complete — AI: ${ad.inserted??0} samples, Real: ${rd.inserted??0} samples aggregated`)
    }catch(e:unknown){setCalMsg(`✗ Error: ${(e as Error)?.message}`)}
    setCalRunning(false)
  }
  if(loading)return<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>
  const s=(stats as any)?.stats||{}
  return(
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Scraped"  value={(s.total_items||0).toLocaleString()} icon={Database}/>
        <Stat label="HF Pushed"      value={(s.hf_pushed||0).toLocaleString()}   icon={Zap}/>
        <Stat label="Active Workers" value={s.worker_count||0}                    icon={Radio}/>
        <Stat label="Last Push"      value={s.last_hf_push?.slice(0,10)||'—'}    icon={Clock}/>
      </div>
      <div className="flex gap-3 flex-wrap">
        <button onClick={trigger} disabled={triggering} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition-colors">{triggering?<Loader2 className="w-4 h-4 animate-spin"/>:<Play className="w-4 h-4"/>}{triggering?'Triggering…':'Trigger Scrape'}</button>
        <button onClick={runCal} disabled={calRunning} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition-colors">{calRunning?<Loader2 className="w-4 h-4 animate-spin"/>:<Activity className="w-4 h-4"/>}{calRunning?'Calibrating…':'Run Calibration'}</button>
        <button onClick={load} className="p-2.5 bg-gray-700/60 rounded-xl text-gray-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4"/></button>
      </div>
      {calMsg&&<div className={`p-4 rounded-xl text-sm font-medium border ${calMsg.startsWith('✓')?'bg-emerald-900/20 text-emerald-300 border-emerald-700/30':'bg-red-900/20 text-red-300 border-red-700/30'}`}>{calMsg}</div>}
    </div>
  )
}

// ── Security ──────────────────────────────────────────────────────────────────
function SecurityTab() {
  const [data,setData]=useState<Record<string,unknown>|null>(null)
  const [loading,setLoading]=useState(true)
  const [nd,setNd]=useState('')
  const [blocking,setBlocking]=useState(false)
  const load=()=>{setLoading(true);api('/security').then(d=>{setData(d);setLoading(false)})}
  useEffect(load,[])
  const blockDomain=async()=>{if(!nd.trim())return;setBlocking(true);await api('/blocked-domains','POST',{domain:nd.trim()});setNd('');load();setBlocking(false)}
  const unblock=async(domain:string)=>{await api('/blocked-domains','DELETE',{domain});load()}
  if(loading)return<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400"/></div>
  const summary=(data?.summary as Record<string,number>)||{}
  const blocked=(data?.blocked_domains as {domain:string;reason?:string}[])||[]
  const events=(data?.events as {id:number;event_type:string;severity:string;ip_address?:string;created_at:string}[])||[]
  return(
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Events (24h)"    value={summary.total_events||0}   color="text-amber-300" icon={AlertCircle}/>
        <Stat label="Critical Events" value={summary.critical_events||0} color="text-red-300"   icon={AlertTriangle}/>
        <Stat label="Blocked Domains" value={summary.blocked_domains||0} color="text-blue-300"  icon={Globe}/>
      </div>
      <Card>
        <p className="text-white font-semibold mb-3">Domain Blocklist</p>
        <div className="flex gap-2 mb-4">
          <input value={nd} onChange={e=>setNd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&blockDomain()} placeholder="example.com" className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none"/>
          <button onClick={blockDomain} disabled={blocking||!nd} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Block</button>
        </div>
        <div className="space-y-2">
          {blocked.map(d=>(
            <div key={d.domain} className="flex items-center justify-between px-3 py-2 bg-gray-700/40 rounded-lg">
              <code className="text-sm text-red-300">{d.domain}</code>
              <button onClick={()=>unblock(d.domain)} className="text-xs text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1"><X className="w-3.5 h-3.5"/>Unblock</button>
            </div>
          ))}
          {!blocked.length&&<p className="text-xs text-gray-600 text-center py-2">No blocked domains</p>}
        </div>
      </Card>
      {events.length>0&&(
        <Card>
          <p className="text-white font-semibold mb-3">Recent Security Events</p>
          <div className="space-y-2">
            {events.slice(0,10).map(ev=>(
              <div key={ev.id} className="flex items-start gap-3 p-3 bg-gray-700/30 rounded-lg">
                <Badge color={ev.severity==='critical'?'red':ev.severity==='high'?'yellow':'gray'}>{ev.severity}</Badge>
                <div className="flex-1"><p className="text-sm text-white">{ev.event_type?.replace(/_/g,' ')}</p>{ev.ip_address&&<p className="text-xs text-gray-500 font-mono">{ev.ip_address}</p>}</div>
                <span className="text-xs text-gray-600">{ev.created_at?.slice(11,16)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const TABS = [
  {id:'analytics',label:'Analytics', icon:BarChart3  },
  {id:'users',    label:'Users',     icon:Users      },
  {id:'pipeline', label:'Pipeline',  icon:Database   },
  {id:'flags',    label:'Flags',     icon:Flag       },
  {id:'errors',   label:'Errors',    icon:AlertCircle},
  {id:'security', label:'Security',  icon:Globe      },
  {id:'settings', label:'Settings',  icon:Settings   },
  {id:'audit',    label:'Audit Log', icon:Clock      },
]

export default function AdminDashboard() {
  const [tab,setTab]=useState('analytics')
  const [checking,setChecking]=useState(true)
  const [overview,setOverview]=useState<Record<string,unknown>|null>(null)
  const router=useRouter()

  useEffect(()=>{
    fetch('/api/auth',{method:'GET'}).then(r=>{
      if(r.status===401)router.push('/')
      else{setChecking(false);api('/stats/overview').then(setOverview)}
    }).catch(()=>router.push('/'))
  },[router])

  const logout=async()=>{await fetch('/api/auth',{method:'DELETE'});router.push('/')}

  if(checking)return<div className="min-h-screen bg-[#0a0a14] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500"/></div>

  const content: Record<string,React.ReactNode>={
    analytics:<AnalyticsTab/>,users:<UsersTab/>,pipeline:<PipelineTab/>,
    flags:<FlagsTab/>,errors:<ErrorsTab/>,security:<SecurityTab/>,
    settings:<SettingsTab/>,audit:<AuditTab/>,
  }

  const ov=overview as any||{}
  return(
    <div className="min-h-screen bg-[#0a0a14] flex">
      <aside className="w-56 shrink-0 bg-[#0d0d1a] border-r border-white/[0.06] flex flex-col">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center"><Shield className="w-4 h-4 text-white"/></div>
            <div><div className="text-white font-bold text-sm">DETECTAI</div><div className="text-gray-600 text-xs">Admin Panel</div></div>
          </div>
        </div>
        {overview&&(
          <div className="px-4 py-3 border-b border-white/[0.04] space-y-1.5">
            {[{l:'Users',v:ov.totalUsers||0},{l:'Scans Today',v:ov.scansToday||0},{l:'Active Subs',v:ov.activeSubs||0}].map(({l,v})=>(
              <div key={l} className="flex justify-between text-xs"><span className="text-gray-600">{l}</span><span className="text-gray-300 font-medium">{Number(v).toLocaleString()}</span></div>
            ))}
          </div>
        )}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {TABS.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setTab(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${tab===id?'bg-purple-600/20 text-purple-300 border border-purple-500/20':'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'}`}>
              <Icon className="w-4 h-4 shrink-0"/>{label}
            </button>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-white/[0.06]">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition-all">
            <LogOut className="w-4 h-4"/>Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div><h1 className="text-xl font-black text-white">{TABS.find(t=>t.id===tab)?.label}</h1><p className="text-gray-600 text-sm mt-0.5">DETECTAI Admin</p></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/><span className="text-xs text-gray-600">Live</span></div>
          </div>
          {content[tab]}
        </div>
      </main>
    </div>
  )
}
