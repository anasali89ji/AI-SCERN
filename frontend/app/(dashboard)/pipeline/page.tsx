'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Play, Globe, BarChart3, CheckCircle, AlertTriangle, HelpCircle, Loader2, Plus, X, Zap, Database, Activity } from 'lucide-react'

interface PipelineResult { url: string; title: string; label: string; confidence: number; chunks: number }
interface PipelineRun { id: string; run_type: string; status: string; metrics: Record<string, number>; started_at: string }
interface PipelineStats { recent_runs: PipelineRun[]; training_samples: number; scraped_pages: number; model: string; hf_connected: boolean }

const SAMPLE_URLS = [
  'https://openai.com/blog', 'https://techcrunch.com', 'https://medium.com',
  'https://news.ycombinator.com', 'https://arxiv.org/abs/recent',
]

export default function PipelinePage() {
  const [urls, setUrls] = useState<string[]>([''])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<PipelineResult[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)
  const [activeTab, setActiveTab] = useState<'collection' | 'stats'>('collection')

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const res = await fetch('/api/pipeline', { method: 'GET' })
    if (res.ok) {
      const statsRes = await fetch('/api/pipeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats' })
      })
      if (statsRes.ok) { const d = await statsRes.json(); if (d.success) setStats(d.data) }
    }
  }

  const addUrl = () => { if (urls.length < 5) setUrls([...urls, '']) }
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i))
  const updateUrl = (i: number, val: string) => { const u = [...urls]; u[i] = val; setUrls(u) }

  const runPipeline = async () => {
    const validUrls = urls.filter(u => u.trim().startsWith('http'))
    if (!validUrls.length) return
    setRunning(true); setResults([]); setLogs([]); setMetrics(null)

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape_pipeline', urls: validUrls })
      })
      const data = await res.json()
      if (data.success) {
        setResults(data.data.results)
        setLogs(data.data.logs || [])
        setMetrics(data.data.metrics)
        await loadStats()
      }
    } catch (e) { console.error(e) }
    finally { setRunning(false) }
  }

  const verdictColor = (v: string) => v === 'AI' ? 'text-rose' : v === 'HUMAN' ? 'text-emerald' : 'text-amber'
  const verdictIcon = (v: string) => v === 'AI' ? AlertTriangle : v === 'HUMAN' ? CheckCircle : HelpCircle

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          Data Collection Pipeline
        </h1>
        <p className="text-text-muted ml-14">Scrape URLs → Classify with HF models → Build LLM training dataset</p>
      </div>

      {/* Status banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Zap, label: 'HF Connected', value: stats.hf_connected ? 'Active' : 'Offline', color: stats.hf_connected ? 'text-emerald' : 'text-rose' },
            { icon: Brain, label: 'Model', value: stats.model.split('/').pop() || stats.model, color: 'text-primary' },
            { icon: Database, label: 'Training Samples', value: stats.training_samples, color: 'text-cyan' },
            { icon: Globe, label: 'Pages Scraped', value: stats.scraped_pages, color: 'text-amber' },
          ].map(s => (
            <div key={s.label} className="card py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-text-muted">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['collection', 'stats'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all
              ${activeTab === tab ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:border-primary/50'}`}>
            {tab === 'collection' ? '🚀 Run Collection' : '📊 History'}
          </button>
        ))}
      </div>

      {activeTab === 'collection' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber" /> Target URLs
                <span className="text-xs text-text-muted ml-auto">Max 5 URLs</span>
              </h3>
              <div className="space-y-2">
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="url" value={url} onChange={e => updateUrl(i, e.target.value)}
                      placeholder="https://example.com/article"
                      className="input-field flex-1 py-2 text-sm" />
                    {urls.length > 1 && (
                      <button onClick={() => removeUrl(i)}
                        className="p-2 rounded-lg text-text-muted hover:text-rose hover:bg-rose/10 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {urls.length < 5 && (
                <button onClick={addUrl}
                  className="mt-3 w-full py-2 border border-dashed border-border rounded-xl text-sm text-text-muted hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add URL
                </button>
              )}

              <div className="mt-4">
                <p className="text-xs text-text-muted mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_URLS.map(u => (
                    <button key={u} onClick={() => { const empty = urls.findIndex(x => !x); if (empty >= 0) updateUrl(empty, u); else if (urls.length < 5) setUrls([...urls, u]) }}
                      className="text-xs px-2 py-1 rounded-md bg-surface border border-border text-text-muted hover:border-primary/50 hover:text-primary transition-colors">
                      {new URL(u).hostname}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={runPipeline} disabled={running || !urls.some(u => u.startsWith('http'))}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-3 text-base font-semibold disabled:opacity-50">
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {running ? 'Running Pipeline...' : '🚀 Launch Pipeline'}
            </button>

            {/* Pipeline steps */}
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3 text-sm">Pipeline Flow</h3>
              <div className="space-y-2">
                {[
                  { step: '1', label: 'Scrape URLs', desc: 'Extract text content from pages', color: 'bg-amber/10 text-amber border-amber/20' },
                  { step: '2', label: 'HF Classification', desc: `Run through Aiscern detection engine`, color: 'bg-primary/10 text-primary border-primary/20' },
                  { step: '3', label: 'Store Training Data', desc: 'Save labeled data to Supabase', color: 'bg-cyan/10 text-cyan border-cyan/20' },
                  { step: '4', label: 'Update Pipeline Metrics', desc: 'Track model performance over time', color: 'bg-emerald/10 text-emerald border-emerald/20' },
                ].map(s => (
                  <div key={s.step} className={`flex items-start gap-3 p-3 rounded-xl border ${s.color.split(' ').slice(2).join(' ')} bg-opacity-10`}>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0 ${s.color}`}>{s.step}</div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{s.label}</p>
                      <p className="text-xs text-text-muted">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="space-y-4">
            {/* Live logs */}
            {(running || logs.length > 0) && (
              <div className="card">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Live Logs
                  {running && <div className="w-2 h-2 rounded-full bg-emerald animate-pulse ml-1" />}
                </h3>
                <div className="bg-surface-active rounded-xl p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-1">
                  {running && !logs.length && (
                    <div className="text-primary animate-pulse">⏳ Initializing pipeline...</div>
                  )}
                  {logs.map((l, i) => (
                    <div key={i} className={l.includes('✅') || l.includes('result') ? 'text-emerald' : l.includes('skip') ? 'text-amber' : 'text-text-muted'}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics */}
            {metrics && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Run Metrics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(metrics).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-surface-active">
                      <p className="text-xs text-text-muted capitalize">{k.replace(/_/g, ' ')}</p>
                      <p className="text-lg font-bold text-text-primary">{typeof v === 'number' ? (k.includes('ms') ? `${v}ms` : v) : v}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Results */}
            <AnimatePresence>
              {results.map((r, i) => {
                const Icon = verdictIcon(r.label)
                return (
                  <motion.div key={r.url} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`card border ${r.label === 'AI' ? 'border-rose/20' : r.label === 'HUMAN' ? 'border-emerald/20' : 'border-amber/20'}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${verdictColor(r.label)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
                        <p className="text-xs text-text-muted truncate">{r.url}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`text-xs font-bold ${verdictColor(r.label)}`}>{r.label}</span>
                          <span className="text-xs text-text-muted">{r.confidence}% confidence</span>
                          <span className="text-xs text-text-muted">{r.chunks} chunks</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {!running && !results.length && (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Brain className="w-12 h-12 text-text-muted mx-auto mb-4 animate-float" />
                <h3 className="font-semibold text-text-primary mb-2">Ready to Run</h3>
                <p className="text-text-muted text-sm max-w-xs">Add URLs above and launch the pipeline to scrape, classify with HuggingFace, and build your training dataset</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-4">
          {stats?.recent_runs?.length === 0 ? (
            <div className="card text-center py-16">
              <Activity className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">No pipeline runs yet. Run your first pipeline above.</p>
            </div>
          ) : (
            stats?.recent_runs?.map((run, i) => (
              <motion.div key={run.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                      ${run.status === 'complete' ? 'bg-emerald/10 text-emerald' : run.status === 'running' ? 'bg-primary/10 text-primary' : 'bg-rose/10 text-rose'}`}>
                      {run.status === 'complete' ? '✅' : run.status === 'running' ? '⏳' : '❌'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary capitalize">{run.run_type} Run</p>
                      <p className="text-xs text-text-muted">{new Date(run.started_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`badge text-xs font-bold px-2 py-1 rounded-full ${run.status === 'complete' ? 'badge-human' : 'badge-uncertain'}`}>
                    {run.status}
                  </span>
                </div>
                {run.metrics && Object.keys(run.metrics).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(run.metrics).slice(0, 3).map(([k, v]) => (
                      <div key={k} className="bg-surface-active rounded-lg p-2 text-center">
                        <p className="text-xs text-text-muted capitalize">{k.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-bold text-text-primary">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
