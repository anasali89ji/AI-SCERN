'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Search, AlertTriangle, CheckCircle, HelpCircle, Loader2, ExternalLink, Image as ImgIcon, FileText, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { validateUrl } from '@/lib/utils/helpers'

interface ScrapedAsset {
  type: string; url?: string; content?: string
  verdict: string; confidence: number; signals: { name: string; flagged: boolean }[]
}
interface ScrapeResult {
  url: string; title: string; description: string
  overall_ai_score: number; total_assets: number; ai_asset_count: number
  assets: ScrapedAsset[]; screenshot_url?: string
}

const verdictIcon = (v: string, cls = 'w-4 h-4') => {
  if (v === 'AI') return <AlertTriangle className={`${cls} text-rose`} />
  if (v === 'HUMAN') return <CheckCircle className={`${cls} text-emerald`} />
  return <HelpCircle className={`${cls} text-amber`} />
}

function ScoreRing({ score }: { score: number }) {
  const r = 54; const c = 2 * Math.PI * r
  const fill = (score / 100) * c
  const color = score >= 60 ? '#F43F5E' : score >= 35 ? '#F59E0B' : '#10B981'
  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1E1E2E" strokeWidth="8" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeLinecap="round"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - fill }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="text-center z-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-4xl font-black" style={{ color }}>{score}%</motion.div>
        <div className="text-xs text-text-muted">AI Score</div>
      </div>
    </div>
  )
}

export default function ScraperPage() {
  const { user: firebaseUser } = useAuth()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState('')
  const supabase = createClient()

  const handleScrape = async () => {
    if (!url.trim()) { setError('Please enter a URL'); return }
    if (!validateUrl(url.trim())) { setError('Please enter a valid URL (include https://)'); return }
    setLoading(true); setError(null); setResult(null)

    const stages = ['Fetching page...', 'Extracting content...', 'Analyzing assets...', 'Generating report...']
    let si = 0
    const interval = setInterval(() => { setStage(stages[si % stages.length]); si++ }, 1800)

    try {
      const res = await fetch('/api/scraper', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      clearInterval(interval)
      if (!data.success) throw new Error(data.error?.message || 'Scraping failed')
      setResult(data.data)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('scraper_sessions').insert({
          user_id: user.id, target_url: url.trim(),
          domain: new URL(url.trim()).hostname,
          page_title: data.data.title, page_description: data.data.description,
          total_assets: data.data.total_assets, ai_asset_count: data.data.ai_asset_count,
          overall_ai_score: data.data.overall_ai_score,
          scraped_content: data.data.assets, status: 'complete'
        })
      }
    } catch (e: unknown) { clearInterval(interval); setError(e instanceof Error ? e.message : 'Scraping failed') }
    finally { setLoading(false); setStage('') }
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
            <Globe className="w-6 h-6 text-amber" />
          </div>
          Web Scraper
        </h1>
        <p className="text-text-muted ml-14">Scan any URL — extract and analyze all images, text, and media for AI content</p>
      </div>

      {/* URL Input */}
      <div className="card mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="url" value={url} onChange={e => { setUrl(e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleScrape()}
              placeholder="https://example.com/article"
              className="input-field pl-10 pr-4 text-base"
            />
          </div>
          <button onClick={handleScrape} disabled={loading}
            className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Scanning...' : 'Scan URL'}
          </button>
        </div>
        {error && <p className="mt-3 text-rose text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
      </div>

      {/* Loading Stage */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card mb-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-6 h-6 text-amber animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{stage || 'Starting...'}</p>
              <p className="text-sm text-text-muted">Analyzing: {url}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Overview */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card">
                <ScoreRing score={result.overall_ai_score} />
                <div className="text-center mt-4">
                  <h3 className="font-semibold text-text-primary">{result.title || 'Untitled Page'}</h3>
                  <a href={result.url} target="_blank" rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 justify-center mt-1">
                    {result.url.substring(0, 50)}… <ExternalLink className="w-3 h-3" />
                  </a>
                  {result.description && <p className="text-xs text-text-muted mt-2 line-clamp-2">{result.description}</p>}
                </div>
              </div>

              <div className="card space-y-4">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Summary
                </h3>
                {[
                  { label: 'Total Assets Scanned', value: result.total_assets, icon: '📦' },
                  { label: 'AI-Generated Assets', value: result.ai_asset_count, icon: '🤖' },
                  { label: 'Human/Original Assets', value: result.total_assets - result.ai_asset_count, icon: '✅' },
                  { label: 'Overall AI Score', value: `${result.overall_ai_score}%`, icon: '📊' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-text-muted flex items-center gap-2">{item.icon} {item.label}</span>
                    <span className="font-bold text-text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset Grid */}
            {result.assets.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber" /> Detected Assets ({result.assets.length})
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.assets.map((asset, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className={`p-3 rounded-xl border transition-all ${
                        asset.verdict === 'AI' ? 'border-rose/30 bg-rose/5' :
                        asset.verdict === 'HUMAN' ? 'border-emerald/30 bg-emerald/5' :
                        'border-amber/30 bg-amber/5'
                      }`}>
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {asset.type === 'image' ? <ImgIcon className="w-4 h-4 text-text-muted" /> : <FileText className="w-4 h-4 text-text-muted" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-muted truncate font-mono">
                            {asset.url ? asset.url.split('/').pop()?.substring(0, 30) : 'Text block'}
                          </p>
                        </div>
                        {verdictIcon(asset.verdict)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${asset.verdict === 'AI' ? 'text-rose' : asset.verdict === 'HUMAN' ? 'text-emerald' : 'text-amber'}`}>
                          {asset.verdict}
                        </span>
                        <span className="text-xs text-text-muted">{asset.confidence}%</span>
                      </div>
                      <div className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${asset.verdict === 'AI' ? 'bg-rose' : asset.verdict === 'HUMAN' ? 'bg-emerald' : 'bg-amber'}`}
                          style={{ width: `${asset.confidence}%` }} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!result && !loading && (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber/10 flex items-center justify-center mx-auto mb-4 animate-float">
            <Globe className="w-10 h-10 text-amber" />
          </div>
          <h3 className="font-semibold text-text-primary mb-2">Enter Any URL</h3>
          <p className="text-text-muted text-sm max-w-sm">
            Paste a link to a news article, blog post, social media page, or any website to analyze all its content for AI generation
          </p>
          <div className="flex gap-2 mt-6 flex-wrap justify-center">
            {['https://techcrunch.com', 'https://medium.com', 'https://reuters.com'].map(u => (
              <button key={u} onClick={() => setUrl(u)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-text-muted hover:border-amber/50 hover:text-amber transition-colors">
                {u}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
