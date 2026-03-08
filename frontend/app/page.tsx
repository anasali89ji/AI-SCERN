'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import {
  Shield, Brain, Eye, Mic, FileText, Globe, Zap, BarChart3,
  ArrowRight, Check, Star, Lock, Activity,
  ChevronRight, Upload, Loader2, CheckCircle, XCircle,
  HelpCircle, Image as ImageIcon, Video, Music, Menu, X
} from 'lucide-react'

/* ─── demo localStorage helpers ─── */
const DEMO_KEY = 'detectai_demo_used'
function getDemoUsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '{}') } catch { return {} }
}
function markDemoUsed(tool: string) {
  if (typeof window === 'undefined') return
  const used = getDemoUsed(); used[tool] = true
  localStorage.setItem(DEMO_KEY, JSON.stringify(used))
}

/* ─── data ─── */
const TOOLS = [
  { id: 'text',   href: '/detect/text',  icon: FileText,  label: 'Text Detector',  color: 'text-amber',     bg: 'bg-amber/10',     border: 'border-amber/20',     desc: 'Detect AI-written articles, essays & content' },
  { id: 'image',  href: '/detect/image', icon: ImageIcon, label: 'Image Detector', color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20',   desc: 'Spot GAN artifacts & diffusion fingerprints' },
  { id: 'audio',  href: '/detect/audio', icon: Music,     label: 'Audio Detector', color: 'text-cyan',      bg: 'bg-cyan/10',      border: 'border-cyan/20',      desc: 'Detect TTS synthesis & voice cloning' },
  { id: 'video',  href: '/detect/video', icon: Video,     label: 'Video Detector', color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/20', desc: 'Frame-by-frame deepfake analysis' },
  { id: 'scraper',href: '/scraper',      icon: Globe,     label: 'Web Scraper',    color: 'text-emerald',   bg: 'bg-emerald/10',   border: 'border-emerald/20',   desc: 'Analyze any URL for AI-generated content' },
  { id: 'batch',  href: '/batch',        icon: BarChart3, label: 'Batch Analyzer', color: 'text-rose',      bg: 'bg-rose/10',      border: 'border-rose/20',      desc: 'Analyze up to 20 files at once' },
]
const FEATURES = [
  { icon: Eye,      title: 'Image Detection',  desc: 'GAN artifacts, diffusion fingerprints, pixel forensics.',           color: 'text-primary',   bg: 'bg-primary/10'   },
  { icon: Zap,      title: 'Video Analysis',   desc: 'Frame-by-frame deepfake & temporal consistency analysis.',           color: 'text-secondary', bg: 'bg-secondary/10' },
  { icon: Mic,      title: 'Audio Detection',  desc: 'Voice synthesis, TTS artifacts, spectral irregularities.',           color: 'text-cyan',      bg: 'bg-cyan/10'      },
  { icon: FileText, title: 'Text Analysis',    desc: 'RoBERTa classifier, perplexity scoring, sentence-level heatmap.',    color: 'text-emerald',   bg: 'bg-emerald/10'   },
  { icon: Globe,    title: 'Web Scraper',      desc: 'Paste any URL to analyze the full page for AI-generated content.',   color: 'text-amber',     bg: 'bg-amber/10'     },
  { icon: BarChart3,title: 'Analytics',        desc: 'Real-time dashboard, scan trends, and model accuracy metrics.',       color: 'text-rose',      bg: 'bg-rose/10'      },
]
const STEPS = [
  { n: '01', title: 'Upload or Paste',  desc: 'Drop any image, video, audio, or paste text / a URL.' },
  { n: '02', title: 'Deep AI Scan',     desc: 'Free HuggingFace models scan for 20+ detection signals in seconds.' },
  { n: '03', title: 'Get Full Report',  desc: 'Confidence score, signal breakdown & sentence-level heatmap.' },
  { n: '04', title: 'Export & Share',   desc: 'Save history, share results, or export reports.' },
]
const STATS   = [{ value: '94%', label: 'Text Accuracy' }, { value: '4', label: 'Media Types' }, { value: '100%', label: 'Free Forever' }, { value: '∞', label: 'Scans / Account' }]
const QUOTES  = [
  { text: 'Caught an AI-written press release before we published it. Saved us massive embarrassment.', name: 'Sarah K.',  role: 'Editor, News Outlet' },
  { text: 'The text analyzer is scary accurate. I tested it on GPT-4 output and it nailed it every time.', name: 'Marcus T.', role: 'AI Researcher' },
  { text: 'Best free deepfake detector I have found. Clean UI and explains WHY it flagged content.',     name: 'Priya M.',  role: 'Content Creator' },
]

/* ─── Text Demo ─── */
function TextDemo({ onUsed, isLoggedIn }: { onUsed: () => void; isLoggedIn: boolean }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const analyze = async () => {
    if (text.length < 50) return
    if (getDemoUsed()['text'] && !isLoggedIn) { router.push('/login'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/detect/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, user_id: null }) })
      const d = await res.json()
      if (d.success) { setResult(d.data); if (!isLoggedIn) { markDemoUsed('text'); onUsed() } }
    } catch {}
    setLoading(false)
  }

  const color = result?.verdict === 'AI' ? 'rose' : result?.verdict === 'HUMAN' ? 'emerald' : 'amber'

  return (
    <div className="space-y-4">
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="Paste any text here (min. 50 characters) to test AI detection for free..."
        className="w-full h-36 bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary transition-colors" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{text.length} chars {text.length < 50 ? '· need 50+' : ''}</span>
        <button onClick={analyze} disabled={loading || text.length < 50}
          className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {loading ? 'Analyzing…' : 'Analyze Free'}
        </button>
      </div>
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border p-4 bg-${color}/5 border-${color}/20`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {result.verdict === 'AI' ? <XCircle className="w-5 h-5 text-rose" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-5 h-5 text-emerald" /> : <HelpCircle className="w-5 h-5 text-amber" />}
              <span className={`font-bold text-lg text-${color}`}>{result.verdict}</span>
            </div>
            <span className="text-2xl font-black text-text-primary">{Math.round(result.confidence)}%</span>
          </div>
          <p className="text-sm text-text-secondary">{result.summary}</p>
          {!isLoggedIn && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
              <p className="text-xs text-text-muted">Sign up for unlimited scans & history</p>
              <Link href="/signup" className="text-xs btn-primary px-3 py-1.5 flex-shrink-0">Get Free Account</Link>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

/* ─── Image Demo ─── */
function ImageDemo({ onUsed, isLoggedIn }: { onUsed: () => void; isLoggedIn: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f); setResult(null)
    const r = new FileReader(); r.onload = e => setPreview(e.target?.result as string); r.readAsDataURL(f)
  }
  const analyze = async () => {
    if (!file) return
    if (getDemoUsed()['image'] && !isLoggedIn) { router.push('/login'); return }
    setLoading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/detect/image', { method: 'POST', body: form })
      const d = await res.json()
      if (d.success) { setResult(d.data); if (!isLoggedIn) { markDemoUsed('image'); onUsed() } }
    } catch {}
    setLoading(false)
  }
  const color = result?.verdict === 'AI' ? 'rose' : result?.verdict === 'HUMAN' ? 'emerald' : 'amber'

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {!file ? (
        <button onClick={() => inputRef.current?.click()}
          className="w-full h-36 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors group">
          <Upload className="w-8 h-8 text-text-muted group-hover:text-primary transition-colors" />
          <span className="text-sm text-text-muted">Click to upload an image</span>
          <span className="text-xs text-text-disabled">JPG, PNG, WebP up to 10MB</span>
        </button>
      ) : (
        <div className="flex gap-4 items-start">
          <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-border flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-secondary truncate">{file.name}</p>
            <p className="text-xs text-text-muted mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <button onClick={() => { setFile(null); setPreview(''); setResult(null) }} className="text-xs text-rose mt-2 hover:underline">Remove</button>
          </div>
        </div>
      )}
      {file && (
        <button onClick={analyze} disabled={loading}
          className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {loading ? 'Analyzing…' : 'Detect AI Image'}
        </button>
      )}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border p-4 bg-${color}/5 border-${color}/20`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {result.verdict === 'AI' ? <XCircle className="w-5 h-5 text-rose" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-5 h-5 text-emerald" /> : <HelpCircle className="w-5 h-5 text-amber" />}
              <span className={`font-bold text-lg text-${color}`}>{result.verdict}</span>
            </div>
            <span className="text-2xl font-black text-text-primary">{Math.round(result.confidence)}%</span>
          </div>
          <p className="text-sm text-text-secondary">{result.summary}</p>
          {!isLoggedIn && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
              <p className="text-xs text-text-muted">Sign up for unlimited scans</p>
              <Link href="/signup" className="text-xs btn-primary px-3 py-1.5 flex-shrink-0">Get Free Account</Link>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDemo, setActiveDemo] = useState<'text' | 'image'>('text')
  const [demoUsedNotice, setDemoUsedNotice] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const isLoggedIn = !loading && !!user

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-surface/95 backdrop-blur-xl border-b border-border shadow-lg shadow-black/20' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">DETECTAI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-text-muted">
            {[['#tools','Tools'],['#features','Features'],['#demo','Try Free'],['#pricing','Pricing']].map(([h,l]) => (
              <a key={h} href={h} className="hover:text-text-primary transition-colors">{l}</a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse hidden sm:inline-block" />
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login"  className="btn-ghost text-xs sm:text-sm py-2 px-2 sm:px-3 hidden sm:block">Sign In</Link>
                <Link href="/signup" className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4">Get Started</Link>
              </>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-text-muted hover:text-text-primary">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="md:hidden bg-surface border-b border-border px-6 pb-4 pt-2 space-y-3">
              {[['#tools','Tools'],['#features','Features'],['#demo','Try Free'],['#pricing','Pricing']].map(([h,l]) => (
                <a key={h} href={h} onClick={() => setMobileOpen(false)} className="block text-sm text-text-muted hover:text-text-primary py-1">{l}</a>
              ))}
              {!isLoggedIn && <Link href="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-primary py-1">Sign In</Link>}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,255,0.12),transparent)] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">100% Free · No Credit Card · Open Detection</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black text-text-primary mb-5 leading-tight tracking-tight">
            Detect AI Content<br /><span className="gradient-text">Before It Spreads</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-base sm:text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed px-2">
            Analyze images, videos, audio, and text for AI generation — powered by free HuggingFace models. No subscription, no limits.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-primary px-8 py-4 text-base font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/25">
                Open Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link href="/signup" className="btn-primary px-8 py-4 text-base font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/25">
                  Start Detecting Free <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#demo" className="btn-ghost px-8 py-4 text-base font-semibold flex items-center justify-center gap-2">
                  Try Without Login
                </a>
              </>
            )}
          </motion.div>

          {isLoggedIn && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mt-4 text-sm text-text-muted flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              Signed in as <span className="text-text-secondary font-medium">{user?.email}</span>
            </motion.p>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-black gradient-text mb-1">{s.value}</div>
              <div className="text-xs text-text-muted">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── TOOLS GRID ── */}
      <section id="tools" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">
              {isLoggedIn ? 'Your Detection' : 'Six Powerful'} <span className="gradient-text">Tools</span>
            </h2>
            <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto">
              {isLoggedIn
                ? 'Click any tool to start detecting — results are saved automatically.'
                : 'Sign up free to access all tools with unlimited scans and history.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {TOOLS.map((tool, i) => (
              <motion.div key={tool.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <Link href={isLoggedIn ? tool.href : `/login?returnTo=${encodeURIComponent(tool.href)}`}
                  className={`block card card-hover group border ${tool.border}`}>
                  <div className={`w-12 h-12 rounded-xl ${tool.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <tool.icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-text-primary">{tool.label}</h3>
                    {isLoggedIn
                      ? <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      : <Lock className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />}
                  </div>
                  <p className="text-sm text-text-muted">{tool.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>

          {!isLoggedIn && (
            <div className="text-center mt-8">
              <Link href="/signup" className="btn-primary px-8 py-3 text-sm inline-flex items-center gap-2">
                Create Free Account — Unlock All Tools <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 bg-surface/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">Everything to <span className="gradient-text">Unmask AI</span></h2>
            <p className="text-text-muted text-sm sm:text-base">Six powerful tools. One platform. Zero cost.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="card group hover:border-primary/30 transition-all">
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="font-bold text-text-primary mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO ── */}
      <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">
              Try It <span className="gradient-text">Right Now</span>
            </h2>
            <p className="text-text-muted text-sm sm:text-base">
              {isLoggedIn
                ? "You're logged in — unlimited scans across all tools."
                : 'One free demo per tool. No account needed for your first try.'}
            </p>
          </div>

          <AnimatePresence>
            {demoUsedNotice && !isLoggedIn && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-6 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Free demo used!</p>
                  <p className="text-xs text-text-muted mt-0.5">Create a free account for unlimited scans.</p>
                </div>
                <Link href="/signup" className="btn-primary text-xs px-4 py-2 flex-shrink-0">Sign Up Free</Link>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="card">
            <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
              {([['text', FileText, 'Text'], ['image', ImageIcon, 'Image']] as const).map(([id, Icon, label]) => {
                const used = !isLoggedIn && getDemoUsed()[id]
                return (
                  <button key={id} onClick={() => setActiveDemo(id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                      ${activeDemo === id ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'}`}>
                    <Icon className="w-4 h-4" />{label}
                    {used && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber" />}
                  </button>
                )
              })}
              <span className="ml-auto text-xs text-text-muted hidden sm:block">
                {isLoggedIn ? '✓ Unlimited scans' : 'Demo: 1 free try per tool'}
              </span>
            </div>

            <AnimatePresence mode="wait">
              {activeDemo === 'text' && (
                <motion.div key="text" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  {!isLoggedIn && getDemoUsed()['text'] ? (
                    <div className="text-center py-12">
                      <Lock className="w-10 h-10 text-text-muted mx-auto mb-4" />
                      <p className="font-semibold text-text-secondary mb-1">Demo used for Text</p>
                      <p className="text-sm text-text-muted mb-6">Create a free account for unlimited text analysis.</p>
                      <Link href="/signup" className="btn-primary px-8 py-3 inline-flex items-center gap-2">Sign Up Free <ArrowRight className="w-4 h-4" /></Link>
                    </div>
                  ) : <TextDemo onUsed={() => setDemoUsedNotice(true)} isLoggedIn={isLoggedIn} />}
                </motion.div>
              )}
              {activeDemo === 'image' && (
                <motion.div key="image" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  {!isLoggedIn && getDemoUsed()['image'] ? (
                    <div className="text-center py-12">
                      <Lock className="w-10 h-10 text-text-muted mx-auto mb-4" />
                      <p className="font-semibold text-text-secondary mb-1">Demo used for Image</p>
                      <p className="text-sm text-text-muted mb-6">Create a free account for unlimited image detection.</p>
                      <Link href="/signup" className="btn-primary px-8 py-3 inline-flex items-center gap-2">Sign Up Free <ArrowRight className="w-4 h-4" /></Link>
                    </div>
                  ) : <ImageDemo onUsed={() => setDemoUsedNotice(true)} isLoggedIn={isLoggedIn} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">How It <span className="gradient-text">Works</span></h2>
            <p className="text-text-muted text-sm sm:text-base">From upload to verdict in under 10 seconds.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-black text-sm">{s.n}</span>
                </div>
                <h3 className="font-bold text-text-primary mb-2">{s.title}</h3>
                <p className="text-sm text-text-muted">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">Trusted by <span className="gradient-text">Researchers & Creators</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {QUOTES.map((q, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="card">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber text-amber" />)}</div>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">"{q.text}"</p>
                <p className="text-sm font-semibold text-text-primary">{q.name}</p>
                <p className="text-xs text-text-muted">{q.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 bg-surface/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">Simple <span className="gradient-text">Pricing</span></h2>
            <p className="text-text-muted text-sm sm:text-base">No tricks. No paywalls. Full platform free forever.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {[
              { name: 'Free', price: '$0', period: 'forever', highlight: false, cta: isLoggedIn ? 'Go to Dashboard' : 'Get Started Free', href: isLoggedIn ? '/dashboard' : '/signup',
                features: ['Unlimited scans', 'All 4 media types', 'Scan history', 'Web scraper', 'HF pipeline access'] },
              { name: 'Pro', price: 'Soon', period: '', highlight: true, cta: 'Join Waitlist', href: '#',
                features: ['Everything in Free', 'Batch processing (100 files)', 'API access', 'PDF export reports', 'Team workspace'] },
            ].map((plan, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`card ${plan.highlight ? 'border-primary/40 bg-primary/5 relative overflow-hidden' : ''}`}>
                {plan.highlight && <div className="absolute top-4 right-4 bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-full">COMING SOON</div>}
                <h3 className="text-lg font-bold text-text-primary mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-black gradient-text">{plan.price}</span>
                  {plan.period && <span className="text-text-muted text-sm mb-1">/{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-emerald flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.highlight ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'btn-primary'}`}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mb-4">Start Detecting <span className="gradient-text">Right Now</span></h2>
            <p className="text-text-muted mb-10 text-sm sm:text-base">Join researchers, journalists & creators who trust DETECTAI.</p>
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-primary px-10 py-4 text-base font-semibold inline-flex items-center gap-2 shadow-lg shadow-primary/25">
                Open Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup" className="btn-primary px-8 py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/25">
                  Create Free Account <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#demo" className="btn-ghost px-8 py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2">
                  Try Demo First
                </a>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold gradient-text">DETECTAI</span>
          </div>
          <p className="text-xs text-text-disabled text-center">Built with HuggingFace · Firebase · Supabase · Next.js · 100% Free</p>
          <div className="flex items-center gap-4">
            <Link href="/login"  className="text-xs text-text-muted hover:text-text-secondary transition-colors">Sign In</Link>
            <Link href="/signup" className="text-xs text-text-muted hover:text-text-secondary transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
