'use client'
import { useState } from 'react'
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
  v === 'AI' ? 'text-[#FF4444]' : v === 'HUMAN' ? 'text-[#2BEE34]' : 'text-[#FFB800]'

const verdictBg = (v: string) =>
  v === 'AI' ? 'bg-[#FF4444]/15 border-[#FF4444]/30' : v === 'HUMAN' ? 'bg-[#2BEE34]/15 border-[#2BEE34]/30' : 'bg-[#FFB800]/15 border-[#FFB800]/30'

function VerdictIcon({ v, cls = 'w-5 h-5' }: { v: string; cls?: string }) {
  if (v === 'AI')    return <AlertTriangle className={`${cls} text-[#FF4444]`} />
  if (v === 'HUMAN') return <CheckCircle   className={`${cls} text-[#2BEE34]`} />
  return               <HelpCircle       className={`${cls} text-[#FFB800]`} />
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
        <p className="text-2xl sm:text-3xl font-black tabular-nums" style={{ color }}>{score}%</p>
        <p className="text-[10px] text-[#A3A3A3] font-medium mt-0.5">AI Score</p>
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
        // Temporary `as any` on the client until Supabase types are regenerated post-migration.
        try {
          await (supabase as any).from('scraper_sessions').insert({
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
    <div className="min-h-screen bg-[#141414] pb-24 lg:pb-8">
      <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 2xl:px-8 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-[#2BEE34]/15 flex items-center justify-center">
              <Globe className="w-5 h-5 text-[#2BEE34]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Web Scanner</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2BEE34]/15 text-[#2BEE34] border border-[#2BEE34]/20">RAG</span>
          </div>
          <p className="text-sm text-[#A3A3A3] ml-12">
            Analyze any website for AI-generated content. Crawls sub-pages, captures screenshot, and uses Gemini RAG for 12-signal detection.
          </p>
        </div>

        {/* Input */}
        <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-4 sm:p-5 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
              <input
                type="url" value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScrape()}
                placeholder="https://example.com/article"
                className="w-full bg-[#141414] border border-white/[0.07] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#2BEE34]/30 transition-colors"
              />
            </div>
            <button
              onClick={() => handleScrape()} disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#2BEE34] hover:bg-[#1A8F1F] text-white text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Scanning…' : 'Scan Site'}
            </button>
          </div>

          {/* Options row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B6B6B]">Crawl depth</span>
              <div className="flex gap-1">
                {[1, 2].map(d => (
                  <button key={d} onClick={() => setDepth(d)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${depth === d ? 'bg-[#2BEE34] text-white' : 'bg-[#141414] text-[#A3A3A3] hover:bg-[#2BEE34]/20'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-[#6B6B6B]">{depth === 1 ? 'Main page only' : 'Follow internal links'}</span>
            </div>
          </div>

          {/* Example URLs */}
          {!result && !loading && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[10px] text-[#6B6B6B] font-medium">Try:</span>
              {EXAMPLES.map(ex => (
                <button key={ex.url} onClick={() => handleScrape(ex.url)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-[#141414] text-[#2BEE34] hover:bg-[#1A8F1F]/15 border border-[#1E1E1E] hover:border-white/[0.12] transition-colors">
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FF4444]/5 border border-[#FF4444]/20">
            <AlertTriangle className="w-4 h-4 text-[#FF4444] shrink-0 mt-0.5" />
            <p className="text-sm text-[#FF4444]">{error}</p>
          </div>
        )}

        {/* Loading skeleton — mirrors result */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 bg-[#141414] border border-[#1E1E1E] rounded-xl overflow-hidden">
                <div className="w-full h-44 bg-white/[0.04] rounded-t-2xl" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
                </div>
              </div>
              <div className="md:col-span-3 bg-[#141414] border border-[#1E1E1E] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                  <div className="w-16 h-16 sm:w-[100px] sm:h-[100px] rounded-full bg-white/[0.04] shrink-0" />
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
            <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-5 space-y-3">
              <div className="h-4 bg-white/[0.04] rounded w-36" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[0,1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-lg bg-white/[0.04]" />)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#6B6B6B] py-1">
              <Loader2 className="w-4 h-4 animate-spin text-[#2BEE34]/60" />
              <span>Fetching page · extracting content · running Gemini RAG analysis…</span>
            </div>
          </div>
        )}

        {/* Results */}
        
          {result && (
            <div className="space-y-4">

              {/* Screenshot + Score row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                {/* Screenshot panel */}
                <div className="md:col-span-2 bg-[#141414] border border-white/[0.07] rounded-xl overflow-hidden">
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
                      <div className="w-full h-44 flex flex-col items-center justify-center bg-[#141414] text-[#6B6B6B]">
                        <Monitor className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs">No preview available</p>
                      </div>
                    )}
                    {/* Overlay badge */}
                    <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${verdictBg(result.verdict)}`}>
                      <VerdictIcon v={result.verdict} cls="w-3.5 h-3.5" />
                      <span className={verdictColor(result.verdict)}>
                        {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-white truncate">{result.title}</p>
                    <a href={result.url} target="_blank" rel="noreferrer"
                      className="text-[10px] text-[#2BEE34] hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" />{result.domain}
                    </a>
                    {result.description && (
                      <p className="text-[10px] text-[#6B6B6B] mt-1.5 line-clamp-2">{result.description}</p>
                    )}
                  </div>
                </div>

                {/* Score + meta panel */}
                <div className="md:col-span-3 bg-[#141414] border border-white/[0.07] rounded-xl p-5">
                  <div className="flex items-start gap-5">
                    <ScoreRing score={result.overall_ai_score} />
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A2A2A] text-[#E5E5E5] border border-[#1E1E1E]">
                          {result.content_type.toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          result.content_quality === 'high' ? 'bg-[#2BEE34]/15 text-[#2BEE34] border-emerald-500/25' :
                          result.content_quality === 'low'  ? 'bg-[#FF4444]/15 text-[#FF4444] border-[#FF4444]/25' :
                          'bg-[#FFB800]/15 text-[#FFB800] border-amber-500/25'}`}>
                          {result.content_quality.toUpperCase()} QUALITY
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2BEE34]/15 text-[#2BEE34] border border-[#2BEE34]/20">
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
                            <span className="text-[#6B6B6B] shrink-0">{label}</span>
                            <span className="text-[#E5E5E5] font-medium truncate text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-4 pt-3 border-t border-[#1E1E1E] space-y-2">
                    <p className="text-xs text-[#E5E5E5] leading-relaxed">{result.summary}</p>
                    {result.reasoning && (
                      <p className="text-[10px] text-[#6B6B6B] leading-relaxed italic">"{result.reasoning}"</p>
                    )}
                    {result.writing_style && (
                      <p className="text-[10px] text-[#6B6B6B]">
                        <span className="text-[#A3A3A3] font-medium">Writing style:</span> {result.writing_style}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Signals grid */}
              {result.signals.length > 0 && (
                <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#2BEE34]" />
                    Detection Signals
                    <span className="ml-auto text-[10px] text-[#6B6B6B] font-normal">{result.signals.filter(s => s.flagged).length} flagged of {result.signals.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.signals.map((sig, i) => (
                      <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${sig.flagged ? 'bg-[#FF4444]/5 border-[#FF4444]/15' : 'bg-[#2BEE34]/5 border-[#2BEE34]/10'}`}>
                        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${sig.flagged ? 'bg-[#FF4444]' : 'bg-[#2BEE34]'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#E5E5E5]">{sig.name}</p>
                          <p className="text-[10px] text-[#6B6B6B] leading-relaxed">{sig.description}</p>
                        </div>
                        {sig.weight != null && (
                          <span className="text-[9px] text-[#6B6B6B] shrink-0 mt-0.5">{Math.round((sig.weight ?? 0) * 10)}/10</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-pages */}
              {result.sub_pages.length > 0 && (
                <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#2BEE34]" />
                    Sub-pages Analyzed
                    <span className="ml-auto text-[10px] text-[#6B6B6B] font-normal">{result.sub_pages.length} pages</span>
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {result.sub_pages.map((sp, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#141414] border border-[#1E1E1E] hover:border-white/[0.12] transition-colors">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${sp.verdict === 'AI' ? 'bg-[#FF4444]' : sp.verdict === 'HUMAN' ? 'bg-[#2BEE34]' : 'bg-[#FFB800]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#E5E5E5] truncate">{sp.title}</p>
                          <a href={sp.url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-[#6B6B6B] hover:text-white transition-colors truncate block">
                            {(() => { try { const u = new URL(sp.url); return u.hostname + u.pathname.slice(0, 40) } catch { return sp.url } })()}
                          </a>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${verdictColor(sp.verdict)}`}>{sp.ai_score}%</p>
                          <p className="text-[10px] text-[#6B6B6B]">{sp.word_count.toLocaleString()} words</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Headings preview */}
              {result.headings && result.headings.length > 0 && (
                <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />Page Structure
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.headings.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-[#141414] text-[#E5E5E5] border border-[#1E1E1E]">
                        {h.slice(0, 60)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Discovered Links */}
              <details className="bg-[#141414] border border-white/[0.07] rounded-xl p-4 group">
                <summary className="cursor-pointer text-sm font-semibold text-[#E5E5E5] flex items-center gap-2 list-none select-none">
                  <Link2 className="w-4 h-4 text-[#2BEE34]" />
                  Discovered Links
                  <span className="text-xs text-[#6B6B6B] font-normal">{result.discovered_links.length} of {result.total_links} total</span>
                  <ChevronDown className="w-4 h-4 text-[#6B6B6B] ml-auto group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-3 space-y-1 max-h-56 overflow-y-auto">
                  {result.discovered_links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#141414] text-xs group/row">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${link.is_internal ? 'bg-[#2BEE34]' : 'bg-[#2BEE34]'}`} />
                      <span className="text-[#A3A3A3] truncate flex-1">{link.text.slice(0, 55)}</span>
                      <a href={link.url} target="_blank" rel="noreferrer"
                        className="text-[#2BEE34] hover:underline truncate max-w-[140px] hidden sm:block text-[10px]">
                        {(() => { try { return new URL(link.url).hostname } catch { return link.url } })()}
                      </a>
                      <button onClick={() => handleScrape(link.url)} title="Scan this page"
                        className="text-[#6B6B6B] hover:text-white transition-colors shrink-0 ml-1">
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </details>

              {/* Datasets info */}
              <details className="bg-[#141414] border border-white/[0.07] rounded-xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#E5E5E5] flex items-center gap-2 list-none select-none">
                  <Info className="w-4 h-4 text-[#2BEE34]" />Detection Models &amp; Reference Datasets
                  <ChevronDown className="w-4 h-4 text-[#6B6B6B] ml-auto" />
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#6B6B6B]">
                  {[
                    { name: 'HC3 Dataset', desc: 'Human ChatGPT Comparison Corpus', url: 'https://huggingface.co/datasets/Hello-SimpleAI/HC3' },
                    { name: 'AI Text Detection Pile', desc: '500K+ labeled text samples', url: 'https://huggingface.co/datasets/artem9k/ai-text-detection-pile' },
                    { name: 'GPT-Wiki-Intro', desc: 'GPT-generated Wikipedia intros', url: 'https://huggingface.co/datasets/aadityaubhat/GPT-wiki-intro' },
                    { name: 'RAID Benchmark', desc: 'Robust AI text detection benchmark', url: 'https://huggingface.co/datasets/liamdugan/raid' },
                  ].map(d => (
                    <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#141414] transition-colors group">
                      <Database className="w-3.5 h-3.5 text-[#2BEE34] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E5E5E5] font-medium group-hover:text-white transition-colors">{d.name}</p>
                        <p>{d.desc}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </details>

            </div>
          )}
        

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-[#2BEE34] opacity-60" />
            </div>
            <p className="text-sm text-[#A3A3A3] font-medium">Enter any website URL above</p>
            <p className="text-xs text-[#6B6B6B] mt-1 max-w-xs">
              Works best with articles, blog posts, and content-heavy pages. Gets a screenshot and runs 12-signal AI detection.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
