'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Globe, Search, TriangleAlert, CircleCheck, CircleHelp,
  LoaderCircle, SquareArrowOutUpRight, ChevronDown, Info,
  FileType2, ImageIcon, Copy, Check, Layers, Fingerprint,
  Zap, AlertOctagon, ListTree, Wrench, BadgeCheck, Gauge,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

// ── Types (mirrors SiteScanResult from lib/scanner/types.ts) ────────────────────
interface EnsembleSignals {
  hfEnsemble: number | null; linguisticBrain: number; perplexityBurst: number
  stylometricFlag: boolean; isSpun: boolean; isThinContent: boolean
}
interface ScannedPage {
  url: string; title: string; wordCount: number; aiScore: number
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'; topFindings: string[]
  ensembleSignals: EnsembleSignals; contentDepthScore: number
}
interface ScannedImage {
  url: string; aiScore: number
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'; modelUsed: string
}
interface SectionHeatmap { pathPrefix: string; aiContentPercent: number; pageCount: number }
interface RemediationItem {
  type: 'page' | 'image' | 'plugin' | 'section'
  url?: string; imageUrl?: string; pluginSlug?: string; sectionPrefix?: string
  action: string; reason: string; priority: 'critical' | 'high' | 'medium' | 'low'
}
interface WPPlugin { slug: string; name?: string; hasVulnerability: boolean; severity?: string; aiRelated: boolean }
interface ContentIntegritySeal { hash: string; timestamp: string; verificationUrl: string }

interface SiteScanResult {
  success: boolean; origin: string; isWordPress: boolean
  discoveryMethod: 'sitemap' | 'crawl' | 'hybrid'
  pagesScanned: number; maxPages: number
  aiContentPercent: number; aiImagePercent: number
  totalImagesAnalyzed: number
  contentOriginalityScore: number; voiceDiversityIndex: number
  transparencyScore: number; linkTrustScore: number
  sectionsHeatmap: SectionHeatmap[]
  wordPressPlugins: WPPlugin[]
  pages: ScannedPage[]; images: ScannedImage[]
  remediation: RemediationItem[]; integritySeal: ContentIntegritySeal
  processingTimeMs: number
  fetchStats: { direct: number; jina: number; cache: number; failed: number }
}

// ── Shared visual helpers (kept identical to the rest of the app's design system) ──
const verdictColor = (v: string) =>
  v === 'AI' ? 'text-[#FF4444]' : v === 'HUMAN' ? 'text-[#2BEE34]' : 'text-[#FFB800]'

const verdictBg = (v: string) =>
  v === 'AI' ? 'bg-[#FF4444]/15 border-[#FF4444]/30' : v === 'HUMAN' ? 'bg-[#2BEE34]/15 border-[#2BEE34]/30' : 'bg-[#FFB800]/15 border-[#FFB800]/30'

function VerdictIcon({ v, cls = 'w-5 h-5' }: { v: string; cls?: string }) {
  if (v === 'AI')    return <TriangleAlert className={`${cls} text-[#FF4444]`} />
  if (v === 'HUMAN') return <CircleCheck   className={`${cls} text-[#2BEE34]`} />
  return               <CircleHelp       className={`${cls} text-[#FFB800]`} />
}

function ScoreRing({ score, size = 140, label = 'AI Content' }: { score: number; size?: number; label?: string }) {
  const r = 48; const c = 2 * Math.PI * r
  const fill  = (score / 100) * c
  const color = score >= 65 ? '#FF4444' : score >= 35 ? '#FFB800' : '#2BEE34'
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#2A2A2A" strokeWidth="9" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="z-10 text-center">
        <p className="text-2xl sm:text-3xl font-black tabular-nums" style={{ color }}>{Math.round(score)}%</p>
        <p className="text-[10px] text-[#A3A3A3] font-medium mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#141414] border border-[#333333] rounded-lg p-3">
      <p className="text-[10px] text-[#6B6B6B] font-medium uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black text-white mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-[#6B6B6B] mt-0.5">{sub}</p>}
    </div>
  )
}

const DISCOVERY_LABEL: Record<SiteScanResult['discoveryMethod'], string> = {
  sitemap: 'SITEMAP DISCOVERY', crawl: 'LINK-CRAWL DISCOVERY', hybrid: 'HYBRID DISCOVERY',
}

const EXAMPLES = [
  { label: 'AI blog', url: 'https://www.jasper.ai/blog/ai-marketing-tools' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
  { label: 'HN post',  url: 'https://news.ycombinator.com' },
]

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ScraperPage() {
  useAuth()
  const [url, setUrl]             = useState('')
  const [deepCrawl, setDeepCrawl] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<SiteScanResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [activeTab, setActiveTab] = useState<string>('pages')

  const tabs = useMemo(() => {
    if (!result) return []
    return [
      { id: 'pages',      label: 'Pages',      icon: FileType2,  count: result.pages.length,            show: result.pages.length > 0 },
      { id: 'images',     label: 'Images',      icon: ImageIcon,  count: result.images.length,           show: result.images.length > 0 },
      { id: 'heatmap',    label: 'Heatmap',     icon: ListTree,   count: result.sectionsHeatmap.length,  show: result.sectionsHeatmap.length > 0 },
      { id: 'wordpress',  label: 'WordPress',   icon: Layers,     count: result.wordPressPlugins.length, show: result.isWordPress && result.wordPressPlugins.length > 0 },
      { id: 'remediation',label: 'Remediation', icon: Wrench,     count: result.remediation.length,      show: result.remediation.length > 0 },
      { id: 'engine',     label: 'Engine Info', icon: Info,       count: null as number | null,          show: true },
    ].filter(t => t.show)
  }, [result])

  // Default to the first available tab whenever a new scan result comes in
  useEffect(() => {
    if (!result) return
    setActiveTab(prev => tabs.some(t => t.id === prev) ? prev : (tabs[0]?.id ?? 'engine'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const handleScan = async (targetUrl?: string) => {
    const scanUrl = (targetUrl ?? url).trim()
    if (!scanUrl) return
    if (targetUrl) setUrl(targetUrl)
    setLoading(true); setError(null); setResult(null); setCopied(false)

    try {
      const res  = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scanUrl, deepCrawl }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error?.message || data.error || 'Site scan failed'); return }
      setResult(data as SiteScanResult)
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Unexpected error')
    } finally { setLoading(false) }
  }

  const copySeal = async () => {
    if (!result?.integritySeal) return
    try {
      await navigator.clipboard.writeText(result.integritySeal.verificationUrl)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unsupported — non-fatal */ }
  }

  const overallVerdict: 'AI' | 'HUMAN' | 'UNCERTAIN' | null = !result ? null :
    result.aiContentPercent > 65 ? 'AI' : result.aiContentPercent < 35 ? 'HUMAN' : 'UNCERTAIN'

  const totalWords = result ? result.pages.reduce((sum, p) => sum + p.wordCount, 0) : 0

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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2BEE34]/15 text-[#2BEE34] border border-[#2BEE34]/20">FORENSIC v2</span>
          </div>
          <p className="text-sm text-[#A3A3A3] ml-12">
            Crawls an entire site (sitemap-first), runs text + image detection on every page, and reports
            stylometric consistency, transparency, link trust, and WordPress fingerprinting.
            Deep Crawl mode extends coverage to up to 150 pages and 200 images.
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
                onKeyDown={e => e.key === 'Enter' && handleScan()}
                placeholder="https://example.com"
                className="w-full bg-[#141414] border border-white/[0.07] rounded-lg pl-9 pr-4 py-2.5 text-[16px] sm:text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#2BEE34]/30 transition-colors"
              />
            </div>
            <button
              onClick={() => handleScan()} disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#2BEE34] hover:bg-[#1A8F1F] text-white text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Scanning site…' : 'Scan Site'}
            </button>
          </div>

          {/* Options row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={() => setDeepCrawl(false)}
                className={`px-2.5 h-7 rounded-lg text-xs font-bold transition-colors ${!deepCrawl ? 'bg-[#2BEE34] text-white' : 'bg-[#141414] text-[#A3A3A3] hover:bg-[#2BEE34]/20'}`}>
                Standard · 30 pages
              </button>
              <button onClick={() => setDeepCrawl(true)}
                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-bold transition-colors ${deepCrawl ? 'bg-[#2BEE34] text-white' : 'bg-[#141414] text-[#A3A3A3] hover:bg-[#2BEE34]/20'}`}>
                <Gauge className="w-3.5 h-3.5" />
                Deep Crawl · 150 pages
              </button>
            </div>
            {deepCrawl && (
              <span className="text-[10px] text-[#6B6B6B]">Deeper crawls take longer — roughly 3–5 minutes for large sites.</span>
            )}
          </div>

          {/* Example URLs */}
          {!result && !loading && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[10px] text-[#6B6B6B] font-medium">Try:</span>
              {EXAMPLES.map(ex => (
                <button key={ex.url} onClick={() => handleScan(ex.url)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-[#141414] text-[#2BEE34] hover:bg-[#1A8F1F]/15 border border-[#333333] hover:border-white/[0.12] transition-colors">
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FF4444]/5 border border-[#FF4444]/20 mb-4">
            <TriangleAlert className="w-4 h-4 text-[#FF4444] shrink-0 mt-0.5" />
            <p className="text-sm text-[#FF4444]">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="bg-[#141414] border border-[#333333] rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                <div className="w-[100px] h-[100px] rounded-full bg-white/[0.04] shrink-0" />
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 content-start">
                  {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-white/[0.04]" />)}
                </div>
              </div>
            </div>
            <div className="bg-[#141414] border border-[#333333] rounded-xl p-5 space-y-3">
              <div className="h-4 bg-white/[0.04] rounded w-36" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[0,1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-lg bg-white/[0.04]" />)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#6B6B6B] py-1">
              <LoaderCircle className="w-4 h-4 animate-spin text-[#2BEE34]/60" />
              <span>Discovering pages · crawling site · running text + image forensics…</span>
            </div>
          </div>
        )}

        {/* Results */}
        {result && overallVerdict && (
          <div className="space-y-4">

            {/* Summary card */}
            <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-5">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <ScoreRing score={result.aiContentPercent} />
                <div className="flex-1 min-w-0 w-full space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${verdictBg(overallVerdict)}`}>
                      <VerdictIcon v={overallVerdict} cls="w-3.5 h-3.5" />
                      <span className={verdictColor(overallVerdict)}>
                        {overallVerdict === 'AI' ? 'Likely AI-Generated' : overallVerdict === 'HUMAN' ? 'Likely Human' : 'Uncertain'}
                      </span>
                    </div>
                    {result.isWordPress && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A2A2A] text-[#E5E5E5] border border-[#333333]">WORDPRESS</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A2A2A] text-[#E5E5E5] border border-[#333333]">
                      {DISCOVERY_LABEL[result.discoveryMethod]}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2BEE34]/15 text-[#2BEE34] border border-[#2BEE34]/20">
                      Full-Site Forensic Engine
                    </span>
                  </div>
                  <a href={result.origin} target="_blank" rel="noreferrer"
                    className="text-sm text-white font-semibold hover:text-[#2BEE34] transition-colors flex items-center gap-1.5">
                    <SquareArrowOutUpRight className="w-3.5 h-3.5 shrink-0" />{result.origin}
                  </a>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatTile label="Pages scanned" value={`${result.pagesScanned}/${result.maxPages}`} sub={result.fetchStats.failed ? `${result.fetchStats.failed} failed` : undefined} />
                    <StatTile label="Words analyzed" value={totalWords.toLocaleString()} />
                    <StatTile label="Images scanned" value={String(result.totalImagesAnalyzed)} sub={`${Math.round(result.aiImagePercent)}% AI`} />
                    <StatTile label="Scan time" value={`${(result.processingTimeMs / 1000).toFixed(1)}s`} />
                  </div>
                </div>
              </div>

              {/* Secondary forensic scores */}
              <div className="mt-4 pt-4 border-t border-[#333333] grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label="Originality" value={`${Math.round(result.contentOriginalityScore)}%`} />
                <StatTile label="Voice diversity" value={`${Math.round(result.voiceDiversityIndex)}%`} />
                <StatTile label="Transparency" value={`${Math.round(result.transparencyScore)}%`} />
                <StatTile label="Link trust" value={`${Math.round(result.linkTrustScore)}%`} />
              </div>
            </div>

            {/* Integrity seal */}
            {result.integritySeal && (
              <div className="bg-[#2BEE34]/5 border border-[#2BEE34]/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#2BEE34]/15 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-5 h-5 text-[#2BEE34]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Content Integrity Seal issued</p>
                  <p className="text-[10px] text-[#6B6B6B] font-mono truncate">{result.integritySeal.hash}</p>
                </div>
                <button onClick={copySeal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] border border-[#333333] hover:border-[#2BEE34]/30 text-xs font-medium text-[#E5E5E5] transition-colors shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-[#2BEE34]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy verify link'}
                </button>
              </div>
            )}


            {/* Section tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors border ${
                    activeTab === t.id
                      ? 'bg-[#2BEE34]/15 text-[#2BEE34] border-[#2BEE34]/30'
                      : 'bg-[#141414] text-[#A3A3A3] border-[#333333] hover:border-white/[0.12]'}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count !== null && <span className="text-[10px] opacity-70">{t.count}</span>}
                </button>
              ))}
            </div>

            {/* Active section panel */}
            <div className="bg-[#141414] border border-white/[0.07] rounded-xl p-5">

              {activeTab === 'heatmap' && (
                <div className="space-y-2">
                  {result.sectionsHeatmap.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-[#A3A3A3] font-mono w-28 sm:w-40 truncate shrink-0">{s.pathPrefix || '/'}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, s.aiContentPercent)}%`, background: s.aiContentPercent >= 65 ? '#FF4444' : s.aiContentPercent >= 35 ? '#FFB800' : '#2BEE34' }} />
                      </div>
                      <span className="text-xs font-bold text-[#E5E5E5] w-12 text-right shrink-0">{Math.round(s.aiContentPercent)}%</span>
                      <span className="text-[10px] text-[#6B6B6B] w-16 text-right shrink-0">{s.pageCount} pg</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'wordpress' && (
                <div className="flex flex-wrap gap-1.5">
                  {result.wordPressPlugins.map((p, i) => (
                    <span key={i} className={`text-[10px] font-medium px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                      p.aiRelated ? 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/25' : 'bg-[#141414] text-[#E5E5E5] border-[#333333]'}`}>
                      {p.aiRelated && <Zap className="w-3 h-3" />}
                      {p.name || p.slug}
                      {p.hasVulnerability && (
                        <TriangleAlert className={`w-3 h-3 ${p.severity === 'critical' || p.severity === 'high' ? 'text-[#FF4444]' : 'text-[#FFB800]'}`} />
                      )}
                    </span>
                  ))}
                </div>
              )}

              {activeTab === 'pages' && (
                <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                  {result.pages.map((p, i) => (
                    <details key={i} className="rounded-lg bg-[#141414] border border-[#333333] hover:border-white/[0.12] transition-colors group">
                      <summary className="flex items-center gap-3 p-3 cursor-pointer list-none select-none">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${p.verdict === 'AI' ? 'bg-[#FF4444]' : p.verdict === 'HUMAN' ? 'bg-[#2BEE34]' : 'bg-[#FFB800]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#E5E5E5] truncate">{p.title || p.url}</p>
                          <p className="text-[10px] text-[#6B6B6B] truncate">{p.url}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.ensembleSignals.isSpun && <span title="Near-duplicate or spun content"><Copy className="w-3 h-3 text-[#FFB800]" /></span>}
                          {p.ensembleSignals.isThinContent && <span title="Thin content"><AlertOctagon className="w-3 h-3 text-[#6B6B6B]" /></span>}
                          <div className="text-right">
                            <p className={`text-sm font-bold ${verdictColor(p.verdict)}`}>{Math.round(p.aiScore)}%</p>
                            <p className="text-[10px] text-[#6B6B6B]">{p.wordCount.toLocaleString()} words</p>
                          </div>
                          <ChevronDown className="w-3.5 h-3.5 text-[#6B6B6B] group-open:rotate-180 transition-transform" />
                        </div>
                      </summary>
                      <div className="px-3 pb-3 pt-1 border-t border-[#333333] mt-1 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                          <div><span className="text-[#6B6B6B]">HF ensemble</span><p className="text-[#E5E5E5] font-semibold">{p.ensembleSignals.hfEnsemble === null ? '—' : `${Math.round(p.ensembleSignals.hfEnsemble * 100)}%`}</p></div>
                          <div><span className="text-[#6B6B6B]">Linguistic brain</span><p className="text-[#E5E5E5] font-semibold">{Math.round(p.ensembleSignals.linguisticBrain * 100)}%</p></div>
                          <div><span className="text-[#6B6B6B]">Perplexity burst</span><p className="text-[#E5E5E5] font-semibold">{Math.round(p.ensembleSignals.perplexityBurst * 100)}%</p></div>
                          <div><span className="text-[#6B6B6B]">Content depth</span><p className="text-[#E5E5E5] font-semibold">{Math.round(p.contentDepthScore)}%</p></div>
                        </div>
                        {p.topFindings.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {p.topFindings.map((f, j) => (
                              <span key={j} className="text-[10px] px-2 py-1 rounded-lg bg-[#141414] text-[#A3A3A3] border border-[#333333]">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {activeTab === 'images' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[32rem] overflow-y-auto pr-1">
                  {result.images.map((img, i) => (
                    <div key={i} className="rounded-lg overflow-hidden border border-[#333333] bg-[#141414]">
                      <div className="relative bg-[#0A0A0A]">
                        <img src={img.url} alt="" referrerPolicy="no-referrer" className="w-full h-24 object-cover"
                          loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
                        <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${verdictBg(img.verdict)} ${verdictColor(img.verdict)}`}>
                          {Math.round(img.aiScore)}%
                        </div>
                      </div>
                      <div className="p-1.5">
                        <p className="text-[9px] text-[#6B6B6B] truncate">{img.modelUsed}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'remediation' && (
                <div className="space-y-1.5">
                  {result.remediation.map((r, i) => {
                    const target = r.url || r.imageUrl || r.pluginSlug || r.sectionPrefix
                    return (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#141414] border border-[#333333]">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2A2A2A] text-[#A3A3A3] shrink-0 mt-0.5 uppercase">{r.type}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#E5E5E5]">{r.action}</p>
                          <p className="text-[10px] text-[#6B6B6B]">{r.reason}</p>
                          {target && (r.url || r.imageUrl) ? (
                            <a href={target} target="_blank" rel="noreferrer" className="text-[10px] text-[#2BEE34] hover:underline truncate block mt-0.5">{target}</a>
                          ) : target ? (
                            <p className="text-[10px] text-[#2BEE34] truncate mt-0.5">{target}</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTab === 'engine' && (
                <div className="space-y-2 text-xs text-[#6B6B6B]">
                  <div className="flex items-start gap-2">
                    <Fingerprint className="w-3.5 h-3.5 text-[#2BEE34] mt-0.5 shrink-0" />
                    <p>Text pages are scored by an ensemble of the HF text-classifier vote, a local linguistic-signal
                    brain, and perplexity-burst analysis, then cross-checked against content depth and stylometric
                    consistency across the whole site.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="w-3.5 h-3.5 text-[#2BEE34] mt-0.5 shrink-0" />
                    <p>Images are analyzed with pixel-level forensics — noise variance, color smoothness, ELA
                    uniformity, and resolution heuristics — combined into a single verdict per image.</p>
                  </div>
                </div>
              )}

            </div>


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
              Crawls the whole site via sitemap discovery, runs forensic text + image detection on every page,
              and flags thin pages and WordPress AI-plugins. Switch to Deep Crawl for sites up to 150 pages.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
