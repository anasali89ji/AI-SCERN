'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Search, AlertTriangle, CheckCircle, HelpCircle,
  Loader2, ExternalLink, Link2, ChevronDown, Database, Info,
  Monitor, FileText, BookOpen, Zap, Shield,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Signal { name: string; flagged: boolean; description: string; weight?: number }
interface SubPage { url: string; title: string; content_type: string; word_count: number; ai_score: number; verdict: string; snippet: string }
interface DiscoveredLink { url: string; text: string; is_internal: boolean }
interface ScrapeResult {
  url: string; domain: string; title: string; description: string
  author?: string; language?: string; publish_date?: string
  content_type: string; word_count: number; content_quality: 'high' | 'medium' | 'low'
  overall_ai_score: number; verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number; summary: string; reasoning?: string; writing_style?: string
  signals: Signal[]; og_image?: string; screenshot_url?: string; image_urls: string[]; agents_used?: number
  headings?: string[]; sub_pages: SubPage[]; discovered_links: DiscoveredLink[]
  total_links: number; status: string; fetch_method?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const verdictColor = (v: string) =>
  v === 'AI' ? 'text-rose-400' : v === 'HUMAN' ? 'text-emerald-400' : 'text-amber-400'

const verdictBg = (v: string) =>
  v === 'AI' ? 'bg-rose-500/15 border-rose-500/30' : v === 'HUMAN' ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-amber-500/15 border-amber-500/30'

function VerdictIcon({ v, cls = 'w-5 h-5' }: { v: string; cls?: string }) {
  if (v === 'AI')    return <AlertTriangle className={`${cls} text-rose-400`} />
  if (v === 'HUMAN') return <CheckCircle   className={`${cls} text-emerald-400`} />
  return               <HelpCircle       className={`${cls} text-amber-400`} />
}

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = 48; const c = 2 * Math.PI * r
  const fill  = (score / 100) * c
  const color = score >= 60 ? '#F43F5E' : score >= 35 ? '#F59E0B' : '#10B981'
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#1e1e2e" strokeWidth="9" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="z-10 text-center">
        <p className="text-3xl font-black tabular-nums" style={{ color }}>{score}%</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">AI Score</p>
      </div>
    </div>
  )
}

const EXAMPLES = [
  { label: 'AI blog', url: 'https://www.jasper.ai/blog/ai-marketing-tools' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
  { label: 'HN post',  url: 'https://news.ycombinator.com' },
]

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ScraperPage() {
  const { user }              = useAuth()
  const [url, setUrl]         = useState('')
  const [depth, setDepth]     = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<ScrapeResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState(false)
  const supabase = createClient()

  const handleScrape = async (targetUrl?: string) => {
    const scanUrl = (targetUrl ?? url).trim()
    if (!scanUrl) return
    if (targetUrl) setUrl(targetUrl)
    setLoading(true); setError(null); setResult(null); setScreenshotError(false)

    try {
      const res  = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scanUrl, depth, maxSubPages: 5 }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error?.message || 'Scan failed'); return }
      setResult(data.data)
      setScreenshotError(false)

      if (user && data.data) {
        // FIX A.3: Removed `as any` cast. Table now created in v9_scraper_sessions.sql.
        // try/catch retained so a DB error never breaks the scan result display.
        try {
          await supabase.from('scraper_sessions').insert({
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
        } catch { /* non-fatal — result still displayed to user */ }
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Unexpected error')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#08080d] pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Globe className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Web Scanner</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">RAG</span>
          </div>
          <p className="text-sm text-slate-400 ml-12">
            Analyze any website for AI-generated content. Crawls sub-pages, captures screenshot, and uses Gemini RAG for 12-signal detection.
          </p>
        </div>

        {/* Input */}
        <div className="bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-4 sm:p-5 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url" value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScrape()}
                placeholder="https://example.com/article"
                className="w-full bg-[#141420] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <button
              onClick={() => handleScrape()} disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Scanning…' : 'Scan Site'}
            </button>
          </div>

          {/* Options row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Crawl depth</span>
              <div className="flex gap-1">
                {[1, 2].map(d => (
                  <button key={d} onClick={() => setDepth(d)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${depth === d ? 'bg-violet-600 text-white' : 'bg-[#141420] text-slate-400 hover:bg-violet-500/20'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{depth === 1 ? 'Main page only' : 'Follow internal links'}</span>
            </div>
          </div>

          {/* Example URLs */}
          {!result && !loading && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[10px] text-slate-600 font-medium">Try:</span>
              {EXAMPLES.map(ex => (
                <button key={ex.url} onClick={() => handleScrape(ex.url)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-[#141420] text-violet-400 hover:bg-violet-500/15 border border-white/5 hover:border-violet-500/30 transition-colors">
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton — mirrors result layout */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 bg-[#0f0f17] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="w-full h-44 bg-white/[0.04] rounded-t-2xl" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
                </div>
              </div>
              <div className="md:col-span-3 bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-5 space-y-4">
                <div className="flex gap-5">
                  <div className="w-[120px] h-[120px] rounded-full bg-white/[0.04] shrink-0" />
                  <div className="flex-1 space-y-2 pt-2">
                    <div className="flex gap-2">
                      <div className="h-5 bg-white/[0.04] rounded-full w-20" />
                      <div className="h-5 bg-white/[0.04] rounded-full w-24" />
                    </div>
                    <div className="h-3 bg-white/[0.04] rounded w-full mt-3" />
                    <div className="h-3 bg-white/[0.04] rounded w-4/5" />
                    <div className="h-3 bg-white/[0.04] rounded w-2/3" />
                  </div>
                </div>
                <div className="h-3 bg-white/[0.04] rounded w-full" />
                <div className="h-3 bg-white/[0.04] rounded w-3/4" />
              </div>
            </div>
            <div className="bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <div className="h-4 bg-white/[0.04] rounded w-36" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[0,1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-white/[0.04]" />)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 py-1">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400/60" />
              <span>Fetching page · extracting content · running Gemini RAG analysis…</span>
            </div>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Screenshot + Score row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                {/* Screenshot panel */}
                <div className="md:col-span-2 bg-[#0f0f17] border border-white/[0.07] rounded-2xl overflow-hidden">
                  <div className="relative">
                    {/* og:image loads instantly from the site's own CDN */}
                    {result.og_image && !screenshotError ? (
                      <img
                        src={result.og_image}
                        alt={`Preview of ${result.domain}`}
                        className="w-full object-cover"
                        style={{ maxHeight: 220, opacity: 0, transition: 'opacity 0.35s' }}
                        onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }}
                        onError={(e) => {
                          // og:image failed — try mshots screenshot as fallback
                          const img = e.target as HTMLImageElement
                          if (result.screenshot_url && !img.dataset.fallback) {
                            img.dataset.fallback = '1'
                            img.src = result.screenshot_url
                          } else {
                            setScreenshotError(true)
                          }
                        }}
                      />
                    ) : result.screenshot_url && !screenshotError ? (
                      <img
                        src={result.screenshot_url}
                        alt={`Screenshot of ${result.domain}`}
                        className="w-full object-cover"
                        style={{ maxHeight: 220, opacity: 0, transition: 'opacity 0.5s' }}
                        onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          if (!img.dataset.retried) {
                            img.dataset.retried = '1'
                            setTimeout(() => { img.src = result.screenshot_url! + '&t=' + Date.now() }, 4000)
                          } else { setScreenshotError(true) }
                        }}
                      />
                    ) : (
                      <div className="w-full h-44 flex flex-col items-center justify-center bg-[#141420] text-slate-600">
                        <Monitor className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs">No preview available</p>
                      </div>
                    )}
                    {/* Overlay badge */}
                    <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold backdrop-blur-sm ${verdictBg(result.verdict)}`}>
                      <VerdictIcon v={result.verdict} cls="w-3.5 h-3.5" />
                      <span className={verdictColor(result.verdict)}>
                        {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-white truncate">{result.title}</p>
                    <a href={result.url} target="_blank" rel="noreferrer"
                      className="text-[10px] text-violet-400 hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" />{result.domain}
                    </a>
                    {result.description && (
                      <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-2">{result.description}</p>
                    )}
                  </div>
                </div>

                {/* Score + meta panel */}
                <div className="md:col-span-3 bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-5">
                  <div className="flex items-start gap-5">
                    <ScoreRing score={result.overall_ai_score} />
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-white/[0.06]">
                          {result.content_type.toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          result.content_quality === 'high' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
                          result.content_quality === 'low'  ? 'bg-rose-500/15 text-rose-400 border-rose-500/25' :
                          'bg-amber-500/15 text-amber-400 border-amber-500/25'}`}>
                          {result.content_quality.toUpperCase()} QUALITY
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
                          Aiscern RAG Engine
                        </span>
                      </div>

                      {/* Meta grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                        {(
                          [
                            ['Domain', result.domain] as [string, string],
                            ['Words', result.word_count.toLocaleString()] as [string, string],
                            result.author       ? ['Author',    result.author]                    as [string, string] : null,
                            result.publish_date ? ['Published', result.publish_date.slice(0, 10)] as [string, string] : null,
                            result.language     ? ['Language',  result.language.toUpperCase()]    as [string, string] : null,
                            ['Confidence', `${result.confidence}%`] as [string, string],
                          ] as ([string, string] | null)[]
                        ).filter((x): x is [string, string] => x !== null).map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-2">
                            <span className="text-slate-500 shrink-0">{label}</span>
                            <span className="text-slate-200 font-medium truncate text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                    <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
                    {result.reasoning && (
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">"{result.reasoning}"</p>
                    )}
                    {result.writing_style && (
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-400 font-medium">Writing style:</span> {result.writing_style}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Signals grid */}
              {result.signals.length > 0 && (
                <div className="bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-violet-400" />
                    Detection Signals
                    <span className="ml-auto text-[10px] text-slate-500 font-normal">{result.signals.filter(s => s.flagged).length} flagged of {result.signals.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.signals.map((sig, i) => (
                      <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${sig.flagged ? 'bg-rose-500/5 border-rose-500/15' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${sig.flagged ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200">{sig.name}</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{sig.description}</p>
                        </div>
                        {sig.weight != null && (
                          <span className="text-[9px] text-slate-600 shrink-0 mt-0.5">{Math.round((sig.weight ?? 0) * 10)}/10</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-pages */}
              {result.sub_pages.length > 0 && (
                <div className="bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-violet-400" />
                    Sub-pages Analyzed
                    <span className="ml-auto text-[10px] text-slate-500 font-normal">{result.sub_pages.length} pages</span>
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {result.sub_pages.map((sp, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#141420] border border-white/5 hover:border-violet-500/20 transition-colors">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${sp.verdict === 'AI' ? 'bg-rose-400' : sp.verdict === 'HUMAN' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">{sp.title}</p>
                          <a href={sp.url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-slate-500 hover:text-violet-400 transition-colors truncate block">
                            {(() => { try { const u = new URL(sp.url); return u.hostname + u.pathname.slice(0, 40) } catch { return sp.url } })()}
                          </a>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${verdictColor(sp.verdict)}`}>{sp.ai_score}%</p>
                          <p className="text-[10px] text-slate-500">{sp.word_count.toLocaleString()} words</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Headings preview */}
              {result.headings && result.headings.length > 0 && (
                <div className="bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />Page Structure
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.headings.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-[#141420] text-slate-300 border border-white/5">
                        {h.slice(0, 60)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Discovered Links */}
              <details className="bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-4 group">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300 flex items-center gap-2 list-none select-none">
                  <Link2 className="w-4 h-4 text-violet-400" />
                  Discovered Links
                  <span className="text-xs text-slate-500 font-normal">{result.discovered_links.length} of {result.total_links} total</span>
                  <ChevronDown className="w-4 h-4 text-slate-500 ml-auto group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-3 space-y-1 max-h-56 overflow-y-auto">
                  {result.discovered_links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#141420] text-xs group/row">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${link.is_internal ? 'bg-violet-400' : 'bg-cyan-400'}`} />
                      <span className="text-slate-400 truncate flex-1">{link.text.slice(0, 55)}</span>
                      <a href={link.url} target="_blank" rel="noreferrer"
                        className="text-violet-400 hover:underline truncate max-w-[140px] hidden sm:block text-[10px]">
                        {(() => { try { return new URL(link.url).hostname } catch { return link.url } })()}
                      </a>
                      <button onClick={() => handleScrape(link.url)} title="Scan this page"
                        className="text-slate-500 hover:text-violet-400 transition-colors shrink-0 ml-1">
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </details>

              {/* Datasets info */}
              <details className="bg-[#0f0f17] border border-white/[0.07] rounded-2xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300 flex items-center gap-2 list-none select-none">
                  <Info className="w-4 h-4 text-violet-400" />Detection Models &amp; Reference Datasets
                  <ChevronDown className="w-4 h-4 text-slate-500 ml-auto" />
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
                      <Database className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-violet-400 opacity-60" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Enter any website URL above</p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              Works best with articles, blog posts, and content-heavy pages. Gets a screenshot and runs 12-signal AI detection.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
