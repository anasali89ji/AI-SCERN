'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Search, AlertTriangle, CheckCircle, HelpCircle,
  Loader2, ExternalLink, Link2, ChevronDown, Database, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubPage {
  url: string; title: string; content_type: string
  word_count: number; ai_score: number; verdict: string; snippet: string
}
interface DiscoveredLink {
  url: string; text: string; is_internal: boolean
}
interface Signal {
  name: string; flagged: boolean; description: string
}
interface ScrapeResult {
  url: string; domain: string; title: string; description: string
  author?: string; publish_date?: string; content_type: string
  word_count: number; content_quality: 'high' | 'medium' | 'low'
  overall_ai_score: number; verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number; summary: string; signals: Signal[]
  image_urls: string[]; sub_pages: SubPage[]
  discovered_links: DiscoveredLink[]; total_links: number
  status: string; engine_used: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function verdictIcon(v: string, cls = 'w-4 h-4') {
  if (v === 'AI')    return <AlertTriangle className={`${cls} text-rose-400`} />
  if (v === 'HUMAN') return <CheckCircle   className={`${cls} text-emerald-400`} />
  return               <HelpCircle       className={`${cls} text-amber-400`} />
}

function verdictColor(v: string) {
  if (v === 'AI')    return 'text-rose-400'
  if (v === 'HUMAN') return 'text-emerald-400'
  return               'text-amber-400'
}

function qualityBadge(q: 'high' | 'medium' | 'low') {
  const map = {
    high:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20   text-amber-400   border-amber-500/30',
    low:    'bg-rose-500/20    text-rose-400    border-rose-500/30',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[q]}`}>
      {q.toUpperCase()} QUALITY
    </span>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 54; const c = 2 * Math.PI * r
  const fill  = (score / 100) * c
  const color = score >= 60 ? '#F43F5E' : score >= 35 ? '#F59E0B' : '#10B981'
  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e1e2e" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-3xl font-black" style={{ color }}>{score}%</p>
        <p className="text-[10px] text-slate-400 font-medium">AI score</p>
      </div>
    </div>
  )
}

// ── Sub-page Row ──────────────────────────────────────────────────────────────
function SubPageRow({ sp }: { sp: SubPage }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141420] border border-white/5 hover:border-violet-500/30 transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        sp.verdict === 'AI' ? 'bg-rose-400' : sp.verdict === 'HUMAN' ? 'bg-emerald-400' : 'bg-amber-400'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{sp.title}</p>
        <a href={sp.url} target="_blank" rel="noreferrer"
          className="text-[10px] text-slate-500 hover:text-violet-400 transition-colors truncate block">
          {(() => { try { const u = new URL(sp.url); return u.hostname + u.pathname.slice(0, 40) } catch { return sp.url } })()}
        </a>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${verdictColor(sp.verdict)}`}>{sp.ai_score}%</p>
        <p className="text-[10px] text-slate-500">{sp.word_count.toLocaleString()} words</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ScraperPage() {
  const { user }                   = useAuth()
  const [url, setUrl]              = useState('')
  const [depth, setDepth]          = useState(1)
  const [loading, setLoading]      = useState(false)
  const [result, setResult]        = useState<ScrapeResult | null>(null)
  const [error, setError]          = useState<string | null>(null)
  const supabase                   = createClient()

  const handleScrape = async (targetUrl?: string) => {
    const scanUrl = (targetUrl ?? url).trim()
    if (!scanUrl) return
    if (targetUrl) setUrl(targetUrl)

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res  = await fetch('/api/scraper', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: scanUrl, depth, maxSubPages: 5 }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error?.message || 'Scan failed')
        return
      }

      setResult(data.data)

      // Save to Supabase (non-fatal)
      if (user && data.data) {
        try {
          await (supabase as ReturnType<typeof createClient>).from('scraper_sessions').insert({
            user_id:          user.uid,
            target_url:       scanUrl,
            domain:           data.data.domain,
            page_title:       data.data.title,
            page_description: data.data.description,
            total_assets:     (data.data.sub_pages?.length ?? 0) + 1,
            ai_asset_count:   data.data.verdict === 'AI' ? 1 : 0,
            overall_ai_score: data.data.overall_ai_score,
            scraped_content:  data.data.signals,
            status:           'complete',
          })
        } catch {}
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#08080d] pb-20 lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-violet-400" />
            Web Scanner
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Scan any website for AI-generated content. Follows links and analyzes sub-pages.
          </p>
        </div>

        {/* Input Row */}
        <div className="bg-[#0f0f17] border border-white/10 rounded-2xl p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScrape()}
                placeholder="https://example.com/article"
                className="w-full bg-[#141420] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <button
              onClick={() => handleScrape()}
              disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Scanning…' : 'Scan'}
            </button>
          </div>

          {/* Depth control */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs text-slate-500">Crawl depth</span>
            <div className="flex gap-1">
              {[1, 2].map(d => (
                <button key={d} onClick={() => setDepth(d)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                    depth === d ? 'bg-violet-600 text-white' : 'bg-[#141420] text-slate-400 hover:bg-violet-500/20'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              {depth === 1 ? 'Main page only' : 'Follow internal links'}
            </span>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Top row: score + meta | sub-pages */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Left — main analysis */}
                <div className="bg-[#0f0f17] border border-white/10 rounded-2xl p-5 space-y-4">
                  <ScoreRing score={result.overall_ai_score} />

                  {/* Verdict + badges */}
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      {verdictIcon(result.verdict, 'w-5 h-5')}
                      <span className={`text-lg font-black ${verdictColor(result.verdict)}`}>
                        {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {qualityBadge(result.content_quality)}
                      <span className="text-[10px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full font-semibold">
                        {result.content_type.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Domain</span>
                      <span className="text-slate-200 font-medium truncate max-w-[180px]">{result.domain}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Word count</span>
                      <span className="text-slate-200 font-medium">{result.word_count.toLocaleString()}</span>
                    </div>
                    {result.author && (
                      <div className="flex justify-between text-slate-400">
                        <span>Author</span>
                        <span className="text-slate-200 font-medium truncate max-w-[160px]">{result.author}</span>
                      </div>
                    )}
                    {result.publish_date && (
                      <div className="flex justify-between text-slate-400">
                        <span>Published</span>
                        <span className="text-slate-200 font-medium">{result.publish_date.slice(0, 10)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>Engine</span>
                      <span className="text-slate-200 font-medium text-right">{result.engine_used}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                    {result.summary}
                  </p>

                  {/* Signals */}
                  {result.signals.length > 0 && (
                    <div className="space-y-1.5 border-t border-white/5 pt-3">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Detection Signals</p>
                      {result.signals.slice(0, 6).map((sig, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${sig.flagged ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-300">{sig.name}</p>
                            <p className="text-[10px] text-slate-500 line-clamp-2">{sig.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right — sub-pages */}
                <div className="bg-[#0f0f17] border border-white/10 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-violet-400" />
                    Sub-pages Analyzed
                    <span className="ml-auto text-[10px] text-slate-500 font-normal">{result.sub_pages.length} pages</span>
                  </h3>

                  {result.sub_pages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-600">
                      <Globe className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-xs">
                        {depth === 1 ? 'Set crawl depth to 2 to follow links' : 'No sub-pages found'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {result.sub_pages.map((sp, i) => <SubPageRow key={i} sp={sp} />)}
                    </div>
                  )}

                  {/* Title of page */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Page Title</p>
                    <p className="text-xs text-slate-300 font-medium">{result.title}</p>
                    {result.description && (
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{result.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Discovered Links Panel */}
              <details className="bg-[#0f0f17] border border-white/10 rounded-2xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300 flex items-center justify-between list-none">
                  <span className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-violet-400" />
                    Discovered Links
                    <span className="text-xs text-slate-500 font-normal">
                      {result.discovered_links.length} of {result.total_links} total
                    </span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </summary>
                <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                  {result.discovered_links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#141420] text-xs group">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${link.is_internal ? 'bg-violet-400' : 'bg-cyan-400'}`} />
                      <span className="text-slate-400 truncate flex-1">{link.text.slice(0, 60)}</span>
                      <a href={link.url} target="_blank" rel="noreferrer"
                        className="text-violet-400 hover:underline truncate max-w-[160px] hidden sm:block">
                        {(() => { try { return new URL(link.url).hostname } catch { return link.url } })()}
                      </a>
                      <button
                        onClick={() => handleScrape(link.url)}
                        title="Analyze this link"
                        className="text-slate-500 hover:text-violet-400 transition-colors flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </details>

              {/* Dataset Info */}
              <details className="bg-[#0f0f17] border border-white/10 rounded-2xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300 flex items-center gap-2 list-none">
                  <Info className="w-4 h-4 text-violet-400" />
                  Detection Models &amp; Datasets
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
                  {[
                    { name: 'HC3 Dataset', desc: 'Human ChatGPT Comparison Corpus', url: 'https://huggingface.co/datasets/Hello-SimpleAI/HC3' },
                    { name: 'AI Text Detection Pile', desc: '500K+ labeled text samples', url: 'https://huggingface.co/datasets/artem9k/ai-text-detection-pile' },
                    { name: 'GPT-Wiki-Intro', desc: 'GPT-generated Wikipedia intros', url: 'https://huggingface.co/datasets/aadityaubhat/GPT-wiki-intro' },
                    { name: 'RAID Benchmark', desc: 'Robust AI text detection benchmark', url: 'https://huggingface.co/datasets/liamdugan/raid' },
                  ].map(d => (
                    <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#141420] transition-colors group">
                      <Database className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-slate-300 font-medium group-hover:text-violet-400 transition-colors">{d.name}</p>
                        <p>{d.desc}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </details>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <Globe className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Enter a URL above to start scanning</p>
            <p className="text-xs mt-1 opacity-70">Works with articles, blogs, Wikipedia, and more</p>
          </div>
        )}
      </div>
    </div>
  )
}
