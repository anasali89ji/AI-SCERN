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
    text: 'text-amber', image: 'text-primary', audio: 'text-cyan', video: 'text-secondary'
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Data Pipeline
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            Training data collection · 87 sources · 5 workers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/55 text-text-muted hover:text-text-primary text-sm transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button onClick={triggerPush} disabled={pushing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60">
            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {pushing ? 'Pushing…' : 'Push to HuggingFace'}
          </button>
        </div>
      </div>

      {pushMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${pushMsg.startsWith('✅') ? 'bg-emerald/10 border-emerald/20 text-emerald' : 'bg-rose/10 border-rose/20 text-rose'}`}>
          {pushMsg}
        </div>
      )}

      {/* Stats Grid */}
      {loading && !stats ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Scraped', value: fmt(stats.total_scraped), icon: Database, color: 'text-primary', sub: `Last: ${ago(stats.last_scrape_at)}` },
              { label: 'Pushed to HF',  value: fmt(stats.total_pushed),  icon: Zap,      color: 'text-emerald', sub: `Last: ${ago(stats.last_push_at)}` },
              { label: 'Pending Push',  value: fmt(stats.pending_push),  icon: Clock,    color: stats.pending_push > 5000 ? 'text-amber' : 'text-text-primary', sub: 'Waiting to push' },
              { label: 'Push Rate',     value: `${stats.push_rate}%`,    icon: TrendingUp, color: 'text-secondary', sub: 'Scraped → HF' },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-surface border border-border/55 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-text-disabled mt-1">{sub}</p>
                  </div>
                  <Icon className="w-5 h-5 text-text-disabled" />
                </div>
              </div>
            ))}
          </div>

          {/* By Media Type */}
          {byType.length > 0 && (
            <div className="bg-surface border border-border/55 rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Breakdown by Type
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {byType.map(b => (
                  <div key={b.media_type} className="text-center p-3 bg-background/60 rounded-xl">
                    <p className={`text-lg font-black capitalize ${COLORS[b.media_type] || 'text-text-primary'}`}>
                      {b.media_type}
                    </p>
                    <p className="text-2xl font-black text-text-primary">{fmt(b.count)}</p>
                    <p className="text-xs text-text-muted mt-1">{fmt(b.pushed)} pushed</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workers */}
          <div className="bg-surface border border-border/55 rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4" /> Workers
            </h3>
            <div className="space-y-2">
              {workers.length > 0 ? workers.map(w => (
                <div key={w.num} className="flex items-center justify-between p-3 bg-background/60 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${w.online ? 'bg-emerald animate-pulse' : 'bg-rose'}`} />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{w.name}</p>
                      {w.error && <p className="text-xs text-rose">{w.error}</p>}
                      {w.version && <p className="text-xs text-text-muted">v{w.version} · {w.role}</p>}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${w.online ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'}`}>
                    {w.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-text-muted text-center py-4">
                  Worker URLs not configured. Add WORKER_A_URL through WORKER_E_URL in Vercel env vars.
                </p>
              )}
            </div>
          </div>

          {/* Recent Pushes */}
          {pushLog.length > 0 && (
            <div className="bg-surface border border-border/55 rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald" /> Recent Pushes to HuggingFace
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pushLog.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background/60 rounded-xl text-sm">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-text-primary">{fmt(p.item_count)} items</p>
                        <p className="text-xs text-text-muted font-mono">{p.commit_id?.slice(0, 12)}…</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium capitalize ${COLORS[p.media_type] || 'text-text-muted'}`}>{p.media_type}</p>
                      <p className="text-xs text-text-disabled">{ago(p.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HF Dataset link */}
          <div className="bg-surface/50 border border-border/40 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">HuggingFace Dataset</p>
              <p className="text-xs text-text-muted">saghi776/detectai-dataset</p>
            </div>
            <a href="https://huggingface.co/datasets/saghi776/detectai-dataset" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all">
              View on HF →
            </a>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-text-muted">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Pipeline data unavailable. Configure Cloudflare D1 env vars.</p>
        </div>
      )}
    </div>
  )
}
