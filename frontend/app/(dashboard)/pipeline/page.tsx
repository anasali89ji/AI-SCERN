'use client'
import { useState, useEffect, useCallback } from 'react'
import { Database, Zap, RefreshCw, Loader2, CheckCircle, Clock, TrendingUp, Radio, BarChart3 } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'



interface PipelineStats {
  total_scraped: number
  total_pushed: number
  pending_push: number
  last_scrape_at: string
  last_push_at: string
  push_rate: number
}
interface Worker { name: string; num: number; online: boolean; error?: string; version?: string; role?: string }
interface PushLog { item_count: number; commit_id: string; status: string; media_type: string; created_at: string }
interface ByType { media_type: string; count: number; pushed: number }

export default function PipelinePage() {
  const { user } = useAuth()
  const [stats, setStats]     = useState<PipelineStats | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [byType, setByType]   = useState<ByType[]>([])
  const [pushLog, setPushLog] = useState<PushLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/pipeline/push')
      if (!r.ok) throw new Error('Failed to load')
      const d = await r.json() as any
      setStats(d.stats)
      setWorkers(d.workers || [])
      setByType(d.by_type || [])
      setPushLog(d.recent_pushes || [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const triggerPush = async () => {
    setPushing(true); setPushMsg(null)
    try {
      const r = await fetch('/api/pipeline/push', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ limit: 10000 }) })
      const d = await r.json() as any
      if (d.ok) {
        const pushed = d.result?.push?.pushed ?? 0
        setPushMsg(`✅ Pushed ${pushed.toLocaleString()} items to HuggingFace`)
        load()
      } else {
        setPushMsg(`❌ ${d.error || 'Push failed'}`)
      }
    } catch (e: any) {
      setPushMsg(`❌ ${e?.message || 'Network error'}`)
    } finally {
      setPushing(false)
    }
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString()
  const ago = (ts: string) => {
    if (!ts) return 'Never'
    const d = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    return d < 1 ? 'Just now' : d < 60 ? `${d}m ago` : `${Math.floor(d/60)}h ago`
  }

  const COLORS: Record<string, string> = {
    text: 'text-[#FFB800]', image: 'text-[#2BEE34]', audio: 'text-[#2BEE34]', video: 'text-[#A3A3A3]'
  }

  return (
    <div className="p-4 sm:p-6 2xl:p-8 space-y-6 max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-[#2BEE34]" />
            Data Pipeline
          </h1>
          <p className="text-[#6B6B6B] text-sm mt-0.5">
            Training data collection · 87 sources · 5 workers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] hover:text-white text-sm transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button onClick={triggerPush} disabled={pushing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2BEE34] text-white text-sm font-semibold hover:bg-[#1A8F1F] transition-all disabled:opacity-60">
            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {pushing ? 'Pushing…' : 'Push to HuggingFace'}
          </button>
        </div>
      </div>

      {pushMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${pushMsg.startsWith('✅') ? 'bg-emerald-500-500/10 border-emerald-500/20 text-emerald-400-400' : 'bg-rose-500-500/10 border-rose-500/20 text-rose-400-500'}`}>
          {pushMsg}
        </div>
      )}

      {/* Stats Grid */}
      {loading && !stats ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BEE34]" /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Scraped', value: fmt(stats.total_scraped), icon: Database, color: 'text-[#2BEE34]', sub: `Last: ${ago(stats.last_scrape_at)}` },
              { label: 'Pushed to HF',  value: fmt(stats.total_pushed),  icon: Zap,      color: 'text-emerald-400-400', sub: `Last: ${ago(stats.last_push_at)}` },
              { label: 'Pending Push',  value: fmt(stats.pending_push),  icon: Clock,    color: stats.pending_push > 5000 ? 'text-[#FFB800]' : 'text-white', sub: 'Waiting to push' },
              { label: 'Push Rate',     value: `${stats.push_rate}%`,    icon: TrendingUp, color: 'text-[#A3A3A3]', sub: 'Scraped → HF' },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-surface border border-[#1E1E1E] rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#6B6B6B] uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-[#6B6B6B] mt-1">{sub}</p>
                  </div>
                  <Icon className="w-5 h-5 text-[#6B6B6B]" />
                </div>
              </div>
            ))}
          </div>

          {/* By Media Type */}
          {byType.length > 0 && (
            <div className="bg-surface border border-[#1E1E1E] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Breakdown by Type
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {byType.map(b => (
                  <div key={b.media_type} className="text-center p-3 bg-background/60 rounded-xl">
                    <p className={`text-lg font-black capitalize ${COLORS[b.media_type] || 'text-white'}`}>
                      {b.media_type}
                    </p>
                    <p className="text-2xl font-black text-white">{fmt(b.count)}</p>
                    <p className="text-xs text-[#6B6B6B] mt-1">{fmt(b.pushed)} pushed</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workers */}
          <div className="bg-surface border border-[#1E1E1E] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4" /> Workers
            </h3>
            <div className="space-y-2">
              {workers.length > 0 ? workers.map(w => (
                <div key={w.num} className="flex items-center justify-between p-3 bg-background/60 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${w.online ? 'bg-emerald-500-500' : 'bg-rose-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{w.name}</p>
                      {w.error && <p className="text-xs text-rose-400">{w.error}</p>}
                      {w.version && <p className="text-xs text-[#6B6B6B]">v{w.version} · {w.role}</p>}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${w.online ? 'bg-emerald-500-500/10 text-emerald-400-400' : 'bg-rose-500-500/10 text-rose-400-500'}`}>
                    {w.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-[#6B6B6B] text-center py-4">
                  Worker URLs not configured. Add WORKER_A_URL through WORKER_E_URL in Vercel env vars.
                </p>
              )}
            </div>
          </div>

          {/* Recent Pushes */}
          {pushLog.length > 0 && (
            <div className="bg-surface border border-[#1E1E1E] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Recent Pushes to HuggingFace
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pushLog.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background/60 rounded-xl text-sm">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{fmt(p.item_count)} items</p>
                        <p className="text-xs text-[#6B6B6B] font-mono">{p.commit_id?.slice(0, 12)}…</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium capitalize ${COLORS[p.media_type] || 'text-[#6B6B6B]'}`}>{p.media_type}</p>
                      <p className="text-xs text-[#6B6B6B]">{ago(p.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HF Dataset link */}
          <div className="bg-[#0f0f17]/50 border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">HuggingFace Dataset</p>
              <p className="text-xs text-[#6B6B6B]">saghi776/detectai-dataset</p>
            </div>
            <a href="https://huggingface.co/datasets/saghi776/detectai-dataset" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#2BEE34]/10 text-[#2BEE34] text-xs font-semibold hover:bg-[#2BEE34]/20 transition-all">
              View on HF →
            </a>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-[#6B6B6B]">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Pipeline data unavailable. Configure Cloudflare D1 env vars.</p>
        </div>
      )}
    </div>
  )
}
