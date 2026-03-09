'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Database, Activity, Upload, RefreshCw, LogOut, BarChart3, CheckCircle, XCircle, Clock, Loader2, Play, Zap, Radio, GitBranch, Server, TrendingUp, ChevronRight, AlertTriangle, Eye, Users, Terminal, Heart, Cpu, Globe } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

const SB_URL = 'https://xtdrwspsbranhunvlbfa.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0ZHJ3c3BzYnJhbmh1bnZsYmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDgwMjEsImV4cCI6MjA4ODI4NDAyMX0.2xKiY0unR1Joq2W5M2YnzluSyjS2eXFZH8NUTm3qfnE'
const HF_REPO = 'saghi776/detectai-dataset'
const sbH: Record<string,string> = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }

async function sbGet(table: string, qs = '') {
  try { const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, { headers: sbH }); return r.ok ? r.json() : [] } catch { return [] }
}
async function callEdge(fn: string, body?: any) {
  try { const r = await fetch(`${SB_URL}/functions/v1/${fn}`, { method: 'POST', headers: sbH, body: JSON.stringify(body || {}) }); return r.json() } catch (e: any) { return { error: e.message } }
}

const STAGES = [
  { id: 'scrape',  label: 'Scrape',  icon: '🌐', color: '#22d3ee', desc: '8 shards · 33 sources' },
  { id: 'clean',   label: 'Dedupe',  icon: '⚙️',  color: '#a78bfa', desc: 'Hash deduplication'   },
  { id: 'augment', label: 'Augment', icon: '📈', color: '#f59e0b', desc: 'Label & split balance'  },
  { id: 'upload',  label: 'Stage',   icon: '📤', color: '#34d399', desc: 'Mark for HF push'       },
  { id: 'hf_push', label: 'HF Push', icon: '🤗', color: '#f472b6', desc: 'Commit to HuggingFace' },
]

const CRON = [
  { name: 'Pipeline Scheduler', schedule: 'Every 5 min',  icon: '⚡' },
  { name: 'Orchestrator',       schedule: 'Every 5 min',  icon: '🎯' },
  { name: 'HF Pusher',          schedule: 'Every 30 min', icon: '🤗' },
  { name: 'Stale Recovery',     schedule: 'Every 10 min', icon: '♻️' },
  { name: 'Metrics Snapshot',   schedule: 'Every hour',   icon: '📊' },
  { name: 'Cleanup',            schedule: 'Daily 3am',    icon: '🧹' },
]

const TABS = [
  { id: 'flow',    label: 'Flow Monitor' },
  { id: 'jobs',    label: 'Jobs'         },
  { id: 'dataset', label: 'Dataset'      },
  { id: 'hf',      label: 'HF Pushes'   },
  { id: 'cron',    label: 'Schedule'     },
  { id: 'overview',label: 'Analytics'    },
]

function Dot({ on, color }: { on: boolean; color: string }) {
  return <span className="inline-flex items-center justify-center w-3 h-3">
    <span className="w-2 h-2 rounded-full inline-block transition-all" style={{ backgroundColor: on ? color : '#374151', boxShadow: on ? `0 0 6px ${color}` : 'none' }} />
  </span>
}

function Stat({ value, label, color, sub }: any) {
  const [n, setN] = useState(0)
  useEffect(() => { const s = Math.max(1, Math.ceil(value/40)); const t = setInterval(()=>setN(p=>{ if(p>=value){clearInterval(t);return value;} return p+s }), 25); return ()=>clearInterval(t) }, [value])
  return <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl" style={{ background: color, transform: 'translate(30%,-30%)' }} />
    <div className="text-3xl font-black font-mono" style={{ color }}>{n.toLocaleString()}</div>
    <div className="text-[#8b949e] text-xs mt-1">{label}</div>
    {sub && <div className="text-[#484f58] text-xs mt-0.5">{sub}</div>}
  </div>
}

function Badge({ status }: { status: string }) {
  const m: Record<string,string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    done:    'bg-green-500/10 text-green-400 border-green-500/20',
    failed:  'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return <span className={`px-2 py-0.5 text-xs border rounded font-mono ${m[status]||'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
    {status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 animate-pulse align-middle" />}{status}
  </span>
}

export default function Dashboard() {
  const router = useRouter()
  const [tab, setTab] = useState('flow')
  const [data, setData] = useState<any>(null)
  const [hfLog, setHfLog] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [hfTriggering, setHfTriggering] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date|null>(null)
  const [liveLog, setLiveLog] = useState<string[]>([])
  const intRef = useRef<any>(null)

  const fetchData = useCallback(async (silent=false) => {
    if (!silent) setRefreshing(true)
    try {
      const [jobs, runs, dsRows, hfLogRows, metricsRows, schedule] = await Promise.all([
        sbGet('pipeline_jobs','select=id,job_type,status,priority,payload,result,error_message,started_at,completed_at,created_at&order=created_at.desc&limit=60'),
        sbGet('pipeline_runs','select=id,run_id,triggered_by,status,jobs_total,jobs_done,jobs_failed,items_scraped,started_at,completed_at&order=started_at.desc&limit=15'),
        sbGet('dataset_items','select=label,media_type,split,is_deduplicated,hf_pushed_at,source_name&limit=200000'),
        sbGet('hf_push_log','select=id,pushed_at,item_count,commit_id,repo,status,error,duration_ms,metadata&order=pushed_at.desc&limit=20'),
        sbGet('pipeline_metrics','select=metric_name,metric_value,recorded_at,tags&order=recorded_at.desc&limit=100'),
        sbGet('pipeline_schedule','select=items_per_run,scrape_interval_h,max_concurrent_jobs,next_run_at,last_run_at,run_count&limit=1'),
      ])
      const rows: any[] = Array.isArray(dsRows) ? dsRows : []
      const srcMap: Record<string,number> = {}
      for (const r of rows) srcMap[r.source_name] = (srcMap[r.source_name]||0)+1
      const ds = {
        total:     rows.length,
        ai:        rows.filter(r=>r.label==='ai').length,
        human:     rows.filter(r=>r.label==='human').length,
        deduped:   rows.filter(r=>r.is_deduplicated).length,
        hf_pushed: rows.filter(r=>r.hf_pushed_at).length,
        pending_hf:rows.filter(r=>r.is_deduplicated&&!r.hf_pushed_at).length,
        text:      rows.filter(r=>r.media_type==='text').length,
        image:     rows.filter(r=>r.media_type==='image').length,
        audio:     rows.filter(r=>r.media_type==='audio').length,
        train:     rows.filter(r=>r.split==='train').length,
        val:       rows.filter(r=>r.split==='val').length,
        test:      rows.filter(r=>r.split==='test').length,
        sources:   srcMap,
      }
      setData({ jobs:Array.isArray(jobs)?jobs:[], runs:Array.isArray(runs)?runs:[], ds, schedule:Array.isArray(schedule)?schedule[0]:null })
      setHfLog(Array.isArray(hfLogRows)?hfLogRows:[])
      setMetrics(Array.isArray(metricsRows)?metricsRows:[])
      setLastRefresh(new Date())
    } catch(e){ console.error(e) }
    setLoading(false)
    setRefreshing(false)
  },[])

  useEffect(()=>{ fetchData() },[fetchData])
  useEffect(()=>{
    if(intRef.current) clearInterval(intRef.current)
    const j=data?.jobs||[]; const active=j.some((j:any)=>['pending','running'].includes(j.status))
    intRef.current=setInterval(()=>fetchData(true), active?6000:12000)
    return ()=>clearInterval(intRef.current)
  },[fetchData,data])

  const runPipeline = async () => {
    setTriggering(true); setLiveLog(['🚀 Scheduling pipeline run...'])
    try {
      const r1=await fetch(`${SB_URL}/rest/v1/rpc/schedule_pipeline_run`,{method:'POST',headers:sbH,body:JSON.stringify({p_triggered_by:'admin-manual'})})
      const rid=await r1.json(); setLiveLog(p=>[...p,`✅ Run ${String(rid).slice(0,8)}`,'⚡ Calling orchestrator...'])
      const r2=await callEdge('pipeline-orchestrator',{source:'admin-manual'})
      setLiveLog(r2?.log?.slice(-15)||[r2?.error?`❌ ${r2.error}`:'✅ Done'])
      setTimeout(()=>fetchData(true),2000); setTimeout(()=>fetchData(true),7000)
    } catch(e:any){ setLiveLog(p=>[...p,`❌ ${e.message}`]) }
    setTriggering(false)
  }

  const pushHF = async () => {
    setHfTriggering(true); setLiveLog(['🤗 Triggering HuggingFace push...'])
    try {
      const r=await callEdge('hf-push',{source:'admin-manual'})
      setLiveLog(r?.log?.slice(-12)||[r?.error?`❌ ${r.error}`:`✅ Pushed ${r?.pushed||0} items`])
      setTimeout(()=>fetchData(true),2000)
    } catch(e:any){ setLiveLog(p=>[...p,`❌ ${e.message}`]) }
    setHfTriggering(false)
  }

  if(loading) return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center"><div className="text-center space-y-3"><div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"/><p className="text-[#484f58] font-mono text-sm">Loading mission control…</p></div></div>

  const jobs=data?.jobs||[]; const runs=data?.runs||[]; const ds=data?.ds||{total:0,ai:0,human:0,deduped:0,hf_pushed:0,pending_hf:0,text:0,image:0,audio:0,train:0,val:0,test:0,sources:{}}; const sched=data?.schedule
  const running=jobs.filter((j:any)=>j.status==='running').length
  const pending=jobs.filter((j:any)=>j.status==='pending').length
  const done=jobs.filter((j:any)=>j.status==='done').length
  const failed=jobs.filter((j:any)=>j.status==='failed').length
  const stageStatus:Record<string,string>={}
  for(const j of jobs.slice(0,20)) if(!stageStatus[j.job_type]||j.status==='running') stageStatus[j.job_type]=j.status
  const srcEntries=Object.entries(ds.sources||{}).sort((a:any,b:any)=>b[1]-a[1]).slice(0,12)
  const srcColors=['#22d3ee','#a78bfa','#f59e0b','#34d399','#f472b6','#60a5fa','#fb923c','#a3e635','#e879f9','#94a3b8','#f87171','#4ade80']
  const labelPie=[{name:'AI',value:ds.ai,color:'#f43f5e'},{name:'Human',value:ds.human,color:'#10b981'}]
  const mediaPie=[{name:'Text',value:ds.text,color:'#22d3ee'},{name:'Image',value:ds.image,color:'#a78bfa'},{name:'Audio',value:ds.audio,color:'#f59e0b'}].filter(d=>d.value>0)
  const splitBars=[{name:'Train',value:ds.train,color:'#3b82f6'},{name:'Val',value:ds.val,color:'#8b5cf6'},{name:'Test',value:ds.test,color:'#ec4899'}]
  const throughput=metrics.filter((m:any)=>m.metric_name==='hf_pushed').slice(0,20).reverse().map((m:any,i:number)=>({i,v:m.metric_value,t:new Date(m.recorded_at).toLocaleTimeString()}))
  const runChart=runs.slice(0,10).reverse().map((r:any,i:number)=>({i,done:r.jobs_done||0,fail:r.jobs_failed||0}))

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]" style={{fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace"}}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700;800&family=Syne:wght@400;700;800;900&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <header className="bg-[#0d1117] border-b border-[#21262d] px-5 py-2.5 flex items-center justify-between sticky top-0 z-50 backdrop-blur-sm">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <span className="text-cyan-400 text-xs">D</span>
            </div>
            <span className="text-white font-bold text-sm tracking-wider" style={{fontFamily:'Syne,sans-serif'}}>DETECTAI</span>
            <span className="text-[#484f58] text-xs">admin</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#484f58] hidden md:flex">
            <span><span className="text-blue-400 font-bold">{running}</span> running</span>
            <span><span className="text-yellow-400 font-bold">{pending}</span> pending</span>
            <span><span className="text-green-400 font-bold">{done}</span> done</span>
            {failed>0&&<span><span className="text-red-400 font-bold">{failed}</span> failed</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh&&<span className="text-[#484f58] text-xs hidden md:block">{lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={()=>fetchData()} className="p-1.5 text-[#484f58] hover:text-cyan-400 transition-colors" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing?'animate-spin':''}`}/>
          </button>
          <button onClick={async()=>{await fetch('/api/auth',{method:'DELETE'}).catch(()=>{}); router.push('/')}} className="px-3 py-1.5 text-xs text-[#484f58] hover:text-red-400 border border-[#21262d] hover:border-red-900/50 rounded transition-all">
            Exit
          </button>
        </div>
      </header>

      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-44 border-r border-[#21262d] sticky top-[45px] h-[calc(100vh-45px)] flex flex-col shrink-0">
          <nav className="p-2 flex-1 space-y-0.5">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${tab===t.id?'bg-cyan-500/10 text-cyan-400':'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]'}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-[#21262d] space-y-2">
            <div className="text-[#484f58] text-xs uppercase tracking-widest mb-1">Live</div>
            {[['Total',ds.total.toLocaleString(),'#22d3ee'],['HF Pushed',ds.hf_pushed.toLocaleString(),'#f472b6'],['Pending',ds.pending_hf.toLocaleString(),'#f59e0b']].map(([l,v,c])=>(
              <div key={l as string} className="flex justify-between text-xs">
                <span className="text-[#484f58]">{l}</span>
                <span className="font-bold" style={{color:c as string}}>{v}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 overflow-auto min-h-[calc(100vh-45px)]">

          {/* ══════════════ FLOW MONITOR ══════════════ */}
          {tab==='flow'&&(
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-white font-black text-xl" style={{fontFamily:'Syne,sans-serif'}}>Pipeline Flow Monitor</h1>
                  <p className="text-[#484f58] text-xs mt-0.5">8 parallel scrapers · 33 sources · auto HF commit every 30min</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={pushHF} disabled={hfTriggering} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-lg hover:bg-pink-500/15 disabled:opacity-40 transition-all">
                    {hfTriggering?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'🤗'} HF Push
                  </button>
                  <button onClick={runPipeline} disabled={triggering} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/15 disabled:opacity-40 transition-all">
                    {triggering?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Play className="w-3.5 h-3.5"/>} Run Pipeline
                  </button>
                </div>
              </div>

              {/* PIPELINE FLOW DIAGRAM */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-6">
                <div className="text-[#484f58] text-xs uppercase tracking-widest mb-5">Automated Pipeline · Triggered Every 5 Min</div>
                <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                  {STAGES.map((s,i)=>{
                    const st=stageStatus[s.id]
                    const isRun=st==='running'; const isDone=st==='done'; const isFail=st==='failed'; const isPend=st==='pending'
                    return <div key={s.id} className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center gap-2 p-4 rounded-xl border min-w-[110px] transition-all relative" style={{
                        borderColor: isRun?s.color:isDone?`${s.color}40`:isFail?'#f43f5e40':'#21262d',
                        backgroundColor: isRun?`${s.color}08`:isDone?`${s.color}05`:'transparent',
                        boxShadow: isRun?`0 0 20px ${s.color}20`:''
                      }}>
                        {isRun&&<div className="absolute inset-0 rounded-xl animate-pulse opacity-5" style={{backgroundColor:s.color}}/>}
                        <div className="text-2xl">{s.icon}</div>
                        <div className="text-xs font-bold text-white">{s.label}</div>
                        <div className="text-[#484f58] text-xs text-center leading-tight">{s.desc}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Dot on={isRun||isPend} color={s.color}/>
                          <span className="text-xs font-mono" style={{color:isRun?s.color:isDone?'#10b981':isFail?'#f43f5e':isPend?s.color:'#484f58'}}>
                            {isRun?'LIVE':isDone?'done':isFail?'err':isPend?'queue':'idle'}
                          </span>
                        </div>
                      </div>
                      {i<STAGES.length-1&&<div className="flex items-center text-[#21262d] text-lg">→</div>}
                    </div>
                  })}
                </div>

                {/* Shard grid */}
                <div className="mt-5 pt-4 border-t border-[#21262d]">
                  <div className="text-[#484f58] text-xs mb-3">Scraper Shards (0–7) · Each covers ~4 sources</div>
                  <div className="flex gap-2">
                    {Array.from({length:8},(_,i)=>{
                      const sj=jobs.filter((j:any)=>j.job_type==='scrape'&&j.payload?.shard===i)
                      const lat=sj[0]; const c=lat?.status==='running'?'#22d3ee':lat?.status==='done'?'#10b981':lat?.status==='failed'?'#f43f5e':'#21262d'
                      const ins=lat?.result?.inserted||0
                      return <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-black transition-all" style={{borderColor:c,color:c,backgroundColor:`${c}10`,boxShadow:lat?.status==='running'?`0 0 12px ${c}40`:''}}>
                          {i}
                        </div>
                        <div className="text-[#484f58] text-xs">{ins?`${(ins/1000).toFixed(1)}k`:lat?.status==='done'?'✓':lat?.status==='running'?'▶':'·'}</div>
                      </div>
                    })}
                  </div>
                </div>
              </div>

              {/* Live log */}
              {liveLog.length>0&&(
                <div className="bg-[#0d1117] border border-cyan-900/30 rounded-xl p-4">
                  <div className="text-cyan-500 text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Radio className="w-3 h-3 animate-pulse"/> Live Output
                  </div>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {liveLog.map((l,i)=><div key={i} className="text-xs text-[#8b949e] font-mono">{l}</div>)}
                  </div>
                </div>
              )}

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat value={ds.total}     label="Total Collected"   color="#22d3ee" sub={`${ds.deduped.toLocaleString()} deduped`}/>
                <Stat value={ds.hf_pushed} label="Pushed to HF"      color="#f472b6" sub={HF_REPO}/>
                <Stat value={ds.pending_hf}label="Pending HF Push"   color="#f59e0b" sub="queued for next push"/>
                <Stat value={done}          label="Jobs Completed"   color="#10b981"  sub={`${failed} failed`}/>
              </div>

              {/* Recent runs */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                <div className="text-[#484f58] text-xs uppercase tracking-widest mb-3">Recent Pipeline Runs</div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {runs.slice(0,8).map((r:any)=>(
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-[#161b22] rounded-lg text-xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${r.status==='running'?'bg-blue-400 animate-pulse':r.status==='done'?'bg-green-400':'bg-[#484f58]'}`}/>
                        <span className="text-[#8b949e] font-mono">{r.run_id?.slice(0,8)||'—'}</span>
                        <span className="text-[#484f58]">{r.triggered_by}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[#484f58]">
                        <span>{r.jobs_done||0}/{r.jobs_total||0} jobs</span>
                        <span>{r.started_at?new Date(r.started_at).toLocaleTimeString():'—'}</span>
                      </div>
                    </div>
                  ))}
                  {!runs.length&&<div className="text-[#484f58] text-xs text-center py-4">No runs yet — trigger one above</div>}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ JOBS ══════════════ */}
          {tab==='jobs'&&(
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-white font-black text-xl" style={{fontFamily:'Syne,sans-serif'}}>Job Tracker</h1>
                <div className="flex gap-3 text-xs">
                  {[['running','#3b82f6',running],['pending','#f59e0b',pending],['done','#10b981',done],['failed','#f43f5e',failed]].map(([s,c,n])=>(
                    <span key={s as string} className="flex items-center gap-1.5 text-[#8b949e]">
                      <span className="w-2 h-2 rounded-full" style={{backgroundColor:c as string}}/>{s}: <span className="font-bold" style={{color:c as string}}>{n as number}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
                <div className="grid grid-cols-6 px-4 py-2 border-b border-[#21262d] text-[#484f58] text-xs uppercase tracking-wider">
                  <span>Type</span><span>Status</span><span>Priority</span><span>Shard</span><span>Result</span><span>Time</span>
                </div>
                <div className="max-h-[65vh] overflow-y-auto divide-y divide-[#161b22]">
                  {jobs.slice(0,60).map((j:any)=>{
                    const r=j.result||{}; const stC=STAGES.find(s=>s.id===j.job_type)?.color||'#8b949e'
                    const res=j.job_type==='scrape'?`${r.inserted||0} inserted`:j.job_type==='clean'?`${r.deduplicated||0} deduped`:j.job_type==='hf_push'?`${r.pushed||0} pushed`:j.job_type==='upload'?`${r.staged||0} staged`:j.error_message?.slice(0,25)||'—'
                    return <div key={j.id} className="grid grid-cols-6 px-4 py-2.5 hover:bg-[#161b22] transition-colors text-xs">
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{backgroundColor:stC}}/><span className="text-[#c9d1d9]">{j.job_type}</span></div>
                      <div><Badge status={j.status}/></div>
                      <div className="text-[#484f58] flex items-center">{j.priority}</div>
                      <div className="text-[#484f58] flex items-center">{j.payload?.shard!==undefined?`S${j.payload.shard}`:'—'}</div>
                      <div className="text-[#8b949e] flex items-center truncate">{res}</div>
                      <div className="text-[#484f58] flex items-center">{new Date(j.completed_at||j.started_at||j.created_at).toLocaleTimeString()}</div>
                    </div>
                  })}
                  {!jobs.length&&<div className="text-[#484f58] text-xs text-center py-8">No jobs found</div>}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ DATASET ══════════════ */}
          {tab==='dataset'&&(
            <div className="p-6 space-y-5">
              <h1 className="text-white font-black text-xl" style={{fontFamily:'Syne,sans-serif'}}>Dataset Statistics</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat value={ds.total}   label="Total Items"    color="#22d3ee"/>
                <Stat value={ds.ai}      label="AI Samples"     color="#f43f5e"/>
                <Stat value={ds.human}   label="Human Samples"  color="#10b981"/>
                <Stat value={ds.deduped} label="Deduplicated"   color="#a78bfa"/>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {title:'Label Split',data:labelPie},
                  {title:'Media Type', data:mediaPie},
                ].map(({title,data})=>(
                  <div key={title} className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                    <div className="text-[#484f58] text-xs uppercase tracking-widest mb-3">{title}</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                          {data.map((e:any,i:number)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:'#161b22',border:'1px solid #21262d',borderRadius:8,color:'#c9d1d9',fontFamily:'JetBrains Mono'}}/>
                        <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:10,color:'#8b949e'}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ))}
                <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                  <div className="text-[#484f58] text-xs uppercase tracking-widest mb-3">Train / Val / Test</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={splitBars} barSize={24}>
                      <XAxis dataKey="name" tick={{fill:'#484f58',fontSize:10}}/>
                      <YAxis tick={{fill:'#484f58',fontSize:9}}/>
                      <Tooltip contentStyle={{background:'#161b22',border:'1px solid #21262d',borderRadius:8,color:'#c9d1d9',fontFamily:'JetBrains Mono'}}/>
                      <Bar dataKey="value" radius={[4,4,0,0]}>{splitBars.map((e,i)=><Cell key={i} fill={e.color}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Source breakdown */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                <div className="text-[#484f58] text-xs uppercase tracking-widest mb-4">Source Breakdown ({srcEntries.length} sources)</div>
                <div className="space-y-2">
                  {srcEntries.map(([src,count],i)=>{
                    const pct=ds.total?Math.round((count as number)/ds.total*100):0
                    return <div key={src} className="flex items-center gap-3">
                      <div className="text-[#484f58] text-xs w-5 text-right">{i+1}</div>
                      <div className="text-[#8b949e] text-xs w-40 truncate">{src}</div>
                      <div className="flex-1 bg-[#21262d] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:srcColors[i%srcColors.length]}}/>
                      </div>
                      <div className="text-[#484f58] text-xs w-14 text-right">{(count as number).toLocaleString()}</div>
                      <div className="text-[#21262d] text-xs w-7 text-right">{pct}%</div>
                    </div>
                  })}
                  {!srcEntries.length&&<div className="text-[#484f58] text-xs text-center py-4">Collecting data…</div>}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ HF PUSHES ══════════════ */}
          {tab==='hf'&&(
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-white font-black text-xl" style={{fontFamily:'Syne,sans-serif'}}>HuggingFace Pushes</h1>
                  <a href={`https://huggingface.co/datasets/${HF_REPO}`} target="_blank" rel="noopener" className="text-pink-400 hover:text-pink-300 text-xs underline">{HF_REPO}</a>
                </div>
                <button onClick={pushHF} disabled={hfTriggering} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-lg hover:bg-pink-500/15 disabled:opacity-40 transition-all">
                  {hfTriggering?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'🤗'} Manual Push
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat value={ds.hf_pushed}  label="Items Pushed"       color="#f472b6"/>
                <Stat value={ds.pending_hf} label="Pending Push"        color="#f59e0b"/>
                <Stat value={hfLog.filter(l=>l.status==='done').length} label="Successful Commits" color="#10b981"/>
              </div>
              {throughput.length>0&&(
                <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                  <div className="text-[#484f58] text-xs uppercase tracking-widest mb-3">Push History</div>
                  <ResponsiveContainer width="100%" height={110}>
                    <AreaChart data={throughput}>
                      <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f472b6" stopOpacity={0.25}/><stop offset="95%" stopColor="#f472b6" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="t" tick={{fill:'#484f58',fontSize:9}}/>
                      <Tooltip contentStyle={{background:'#161b22',border:'1px solid #21262d',borderRadius:8,color:'#c9d1d9',fontFamily:'JetBrains Mono'}}/>
                      <Area type="monotone" dataKey="v" stroke="#f472b6" fill="url(#pg)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
                <div className="grid grid-cols-5 px-4 py-2 border-b border-[#21262d] text-[#484f58] text-xs uppercase tracking-wider">
                  <span>Status</span><span>Items</span><span>Commit</span><span>Duration</span><span>Time</span>
                </div>
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-[#161b22]">
                  {hfLog.map((l:any)=>(
                    <div key={l.id} className="grid grid-cols-5 px-4 py-3 text-xs hover:bg-[#161b22]">
                      <div>{l.status==='done'?<span className="text-green-400">✓ done</span>:<span className="text-red-400">✗ failed</span>}</div>
                      <div className="text-cyan-400 font-bold">{(l.item_count||0).toLocaleString()}</div>
                      <div className="font-mono text-[#484f58]">
                        {l.commit_id?<a href={`https://huggingface.co/datasets/${HF_REPO}/commit/${l.commit_id}`} target="_blank" rel="noopener" className="text-pink-400 hover:underline">{l.commit_id.slice(0,10)}…</a>:'—'}
                      </div>
                      <div className="text-[#484f58]">{l.duration_ms?`${(l.duration_ms/1000).toFixed(1)}s`:'—'}</div>
                      <div className="text-[#484f58]">{new Date(l.pushed_at).toLocaleString()}</div>
                    </div>
                  ))}
                  {!hfLog.length&&<div className="text-[#484f58] text-xs text-center py-8">No pushes yet — will run automatically every 30 min</div>}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ SCHEDULE ══════════════ */}
          {tab==='cron'&&(
            <div className="p-6 space-y-5">
              <h1 className="text-white font-black text-xl" style={{fontFamily:'Syne,sans-serif'}}>Automation Schedule</h1>
              {sched&&(
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[['Items/Run',(sched.items_per_run||0).toLocaleString(),'#22d3ee'],['Interval',`${sched.scrape_interval_h}h`,'#a78bfa'],['Concurrency',sched.max_concurrent_jobs,'#f59e0b'],['Total Runs',(sched.run_count||0).toLocaleString(),'#10b981']].map(([l,v,c])=>(
                    <div key={l as string} className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4">
                      <div className="font-mono text-2xl font-black" style={{color:c as string}}>{v}</div>
                      <div className="text-[#484f58] text-xs mt-1">{l}</div>
                    </div>
                  ))}
                </div>
              )}
              {sched?.next_run_at&&(
                <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-5 py-3 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-yellow-400"/>
                  <div><div className="text-yellow-400 text-xs font-bold">Next Scheduled Run</div>
                  <div className="text-[#c9d1d9] text-sm mt-0.5">{new Date(sched.next_run_at).toLocaleString()}</div></div>
                </div>
              )}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#21262d] text-[#484f58] text-xs uppercase tracking-widest">Active pg_cron Jobs</div>
                <div className="divide-y divide-[#161b22]">
                  {CRON.map(j=>(
                    <div key={j.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#161b22] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{j.icon}</span>
                        <div><div className="text-[#c9d1d9] text-sm">{j.name}</div>
                        <div className="text-[#484f58] text-xs font-mono">{j.schedule}</div></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
                        <span className="text-green-400 text-xs">ACTIVE</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Architecture */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                <div className="text-[#484f58] text-xs uppercase tracking-widest mb-4">System Architecture</div>
                <pre className="text-xs text-[#8b949e] leading-relaxed overflow-x-auto">{`
pg_cron (5min) ──→ schedule_pipeline_run()
                      └── 8 × scrape[shard 0..7]  (priority 1, all parallel)
                      └── clean    (priority 2)
                      └── augment  (priority 3)
                      └── upload   (priority 4)
                      └── hf_push  (priority 5)

pg_cron (5min) ──→ pipeline-orchestrator [edge fn]
                      └── picks up pending jobs, runs in parallel groups

pg_cron (30min) ─→ hf-push [edge fn]
                      └── commits un-pushed items to HuggingFace as JSONL

pg_cron (10min) ─→ recover_stale_jobs()
                      └── resets stuck running jobs >15 min

GitHub Actions (6h) → orchestrator + hf-push [backup]
                `.trim()}</pre>
              </div>
            </div>
          )}

          {/* ══════════════ ANALYTICS ══════════════ */}
          {tab==='overview'&&(
            <div className="p-6 space-y-5">
              <h1 className="text-white font-black text-xl" style={{fontFamily:'Syne,sans-serif'}}>Analytics</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat value={ds.total}     label="Total Collected" color="#22d3ee"/>
                <Stat value={ds.hf_pushed} label="HF Pushed"       color="#f472b6"/>
                <Stat value={ds.ai}        label="AI Samples"      color="#f43f5e" sub={`${ds.total?Math.round(ds.ai/ds.total*100):0}% of total`}/>
                <Stat value={ds.human}     label="Human Samples"   color="#10b981" sub={`${ds.total?Math.round(ds.human/ds.total*100):0}% of total`}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                  <div className="text-[#484f58] text-xs uppercase tracking-widest mb-3">Jobs per Run (last 10)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={runChart} barGap={3}>
                      <XAxis dataKey="i" tick={{fill:'#484f58',fontSize:10}}/>
                      <YAxis tick={{fill:'#484f58',fontSize:10}}/>
                      <Tooltip contentStyle={{background:'#161b22',border:'1px solid #21262d',borderRadius:8,color:'#c9d1d9',fontFamily:'JetBrains Mono'}}/>
                      <Bar dataKey="done" name="Done" fill="#10b981" radius={[3,3,0,0]}/>
                      <Bar dataKey="fail" name="Failed" fill="#f43f5e" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                  <div className="text-[#484f58] text-xs uppercase tracking-widest mb-3">HF Push History</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={throughput.length?throughput:[{i:0,v:ds.hf_pushed,t:'now'}]}>
                      <defs><linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f472b6" stopOpacity={0.2}/><stop offset="95%" stopColor="#f472b6" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="t" tick={{fill:'#484f58',fontSize:9}}/>
                      <Tooltip contentStyle={{background:'#161b22',border:'1px solid #21262d',borderRadius:8,color:'#c9d1d9',fontFamily:'JetBrains Mono'}}/>
                      <Area type="monotone" dataKey="v" stroke="#f472b6" fill="url(#pg2)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Quick links */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'HF Dataset',url:`https://huggingface.co/datasets/${HF_REPO}`,color:'#f472b6',icon:'🤗'},
                  {label:'Main Platform',url:'https://detect-ai-nu.vercel.app',color:'#22d3ee',icon:'🌐'},
                  {label:'GitHub',url:'https://github.com/saghirahmed9067-png/DETECT-AI',color:'#a78bfa',icon:'📦'},
                ].map(l=>(
                  <a key={l.label} href={l.url} target="_blank" rel="noopener" className="flex items-center gap-3 bg-[#0d1117] border border-[#21262d] hover:border-[#30363d] rounded-xl p-4 transition-all group">
                    <span className="text-xl">{l.icon}</span>
                    <div><div className="text-xs font-bold" style={{color:l.color}}>{l.label}</div>
                    <div className="text-[#484f58] text-xs truncate">{l.url.replace('https://','')}</div></div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
      <style jsx global>{`
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#21262d;border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:#30363d;}
      `}</style>
    </div>
  )
}
