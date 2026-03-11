'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { SiteFooter } from '@/components/site-footer'
import {
  Shield, Brain, Eye, Mic, FileText, Globe, Zap, BarChart3,
  ArrowRight, CheckCircle, XCircle, HelpCircle,
  Image as ImageIcon, Video, Music, ChevronRight, Loader2,
  MessageSquare, Cpu, Lock, Database, AlertTriangle, Sparkles,
  TrendingUp, Users, Award, Play, Menu, X, Search,
  Scan, Fingerprint, Waves, Dna, Bot, Radio,
  Activity, Layers, Wand2
} from 'lucide-react'

// ─── Canvas Particle Network ───────────────────────────────────────────────
function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number
    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H

    const NODES = 50
    const nodes = Array.from({ length: NODES }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: 1.5 + Math.random() * 1.5,
      pulse: Math.random() * Math.PI * 2,
    }))

    function draw() {
      ctx.clearRect(0, 0, W, H)
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
        n.pulse += 0.02
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.18
            ctx.beginPath()
            ctx.strokeStyle = `rgba(124,58,237,${alpha})`
            ctx.lineWidth = 0.8
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        const alpha = 0.4 + Math.sin(n.pulse) * 0.25
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(124,58,237,${alpha})`
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W; canvas.height = H
    }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-60" />
}

// ─── Interactive Floating Cards (SVG icons, no emoji) ──────────────────────
const FLOAT_ITEMS = [
  {
    Icon: Search, label: 'AI Text', pct: '94.2%', color: '#7c3aed',
    x: '6%', y: '18%', delay: 0,
    pulse: true,
  },
  {
    Icon: Eye, label: 'Deepfake', pct: '97.1%', color: '#2563eb',
    x: '80%', y: '12%', delay: 0.6,
    pulse: false,
  },
  {
    Icon: Waves, label: 'AI Audio', pct: '91.8%', color: '#06b6d4',
    x: '3%', y: '60%', delay: 1.2,
    pulse: false,
  },
  {
    Icon: Video, label: 'AI Video', pct: '88.5%', color: '#10b981',
    x: '83%', y: '56%', delay: 0.3,
    pulse: false,
  },
  {
    Icon: Bot, label: 'GPT-4', pct: 'Detected', color: '#f43f5e',
    x: '48%', y: '80%', delay: 0.9,
    pulse: true,
  },
  {
    Icon: Fingerprint, label: 'Stable Diff', pct: 'Flagged', color: '#f59e0b',
    x: '18%', y: '83%', delay: 1.5,
    pulse: false,
  },
]

function FloatingCards() {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <>
      {FLOAT_ITEMS.map((item, i) => {
        const Icon = item.Icon
        const isHovered = hovered === i
        return (
          <motion.div key={i}
            className="absolute hidden lg:flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border backdrop-blur-xl z-10 cursor-pointer select-none"
            style={{
              left: item.x, top: item.y,
              background: `${item.color}18`,
              borderColor: isHovered ? `${item.color}70` : `${item.color}35`,
              boxShadow: isHovered
                ? `0 0 30px ${item.color}40, 0 0 60px ${item.color}20`
                : `0 0 20px ${item.color}20`,
            }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
              opacity: 1, scale: isHovered ? 1.08 : 1,
              y: isHovered ? -14 : [0, -10, 0],
            }}
            transition={{
              opacity: { delay: item.delay + 0.5, duration: 0.6 },
              scale: { duration: 0.2 },
              y: isHovered
                ? { duration: 0.2 }
                : { delay: item.delay, duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }
            }}
            onHoverStart={() => setHovered(i)}
            onHoverEnd={() => setHovered(null)}
          >
            {/* Animated icon container */}
            <motion.div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${item.color}28`, color: item.color }}
              animate={isHovered ? { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.8} />
            </motion.div>

            <div>
              <div className="text-[10px] font-medium" style={{ color: `${item.color}cc` }}>{item.label}</div>
              <div className="text-xs font-bold text-white">{item.pct}</div>
            </div>

            {/* Live pulse dot for "active" cards */}
            {item.pulse && (
              <motion.div
                className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full"
                style={{ background: item.color }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        )
      })}
    </>
  )
}

// ─── Live Counter ───────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0
        const step = target / 60
        const interval = setInterval(() => {
          start += step
          if (start >= target) { setCount(target); clearInterval(interval) }
          else setCount(Math.floor(start))
        }, 16)
      }
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ─── Live Demo ───────────────────────────────────────────────────────────────
function LiveDemo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [used, setUsed] = useState(false)
  const router = useRouter()

  const analyze = async () => {
    if (text.length < 50) return
    if (used && !isLoggedIn) { router.push('/signup'); return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: null }),
      })
      const d = await res.json()
      if (d.success) { setResult(d.data); setUsed(true) }
      else setResult({ verdict: 'ERROR', confidence: 0 })
    } catch { setResult({ verdict: 'ERROR', confidence: 0 }) }
    setLoading(false)
  }

  const examples = [
    { label: 'AI text', text: 'The intersection of artificial intelligence and human creativity presents a fascinating paradox in contemporary discourse. As machine learning models become increasingly sophisticated in generating coherent, contextually appropriate text, the boundaries between human and algorithmic authorship continue to blur in unprecedented ways.' },
    { label: 'Human text', text: 'I spent all weekend trying to fix my leaky faucet and honestly I have no idea what I\'m doing. Watched like 6 YouTube videos and still made it worse. Water is now shooting sideways. My neighbor thinks it\'s hilarious. Calling a plumber tomorrow. RIP my bank account.' },
  ]

  return (
    <div className="relative">
      <div className="card border-primary/20 bg-surface/80 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-sm font-semibold text-text-primary">Live AI Detector</span>
          </div>
          <div className="flex gap-2">
            {examples.map(ex => (
              <button key={ex.label} onClick={() => setText(ex.text)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border hover:border-primary/50 text-text-muted hover:text-primary transition-all">
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste any text to detect if it's AI-generated… (min 50 characters)"
          className="w-full h-28 sm:h-32 bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors" />

        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <span className="text-xs text-text-muted">{text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '✓'}</span>
          <button onClick={analyze} disabled={loading || text.length < 50}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Scanning…' : 'Analyze Free'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className={`rounded-xl border p-4 ${result.verdict === 'AI' ? 'bg-rose/5 border-rose/20' : result.verdict === 'HUMAN' ? 'bg-emerald/5 border-emerald/20' : 'bg-amber/5 border-amber/20'}`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {result.verdict === 'AI' ? <XCircle className="w-5 h-5 text-rose" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-5 h-5 text-emerald" /> : <HelpCircle className="w-5 h-5 text-amber" />}
                    <span className={`font-bold text-base sm:text-lg ${result.verdict === 'AI' ? 'text-rose' : result.verdict === 'HUMAN' ? 'text-emerald' : 'text-amber'}`}>
                      {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-text-primary">{Math.round(result.confidence || 0)}%</div>
                    <div className="text-xs text-text-muted">confidence</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence || 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-rose' : result.verdict === 'HUMAN' ? 'bg-emerald' : 'bg-amber'}`} />
                </div>
                {!isLoggedIn && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-text-muted">Sign up for unlimited scans, history & more</p>
                    <Link href="/signup" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                      Get started free <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── How It Works Icons (SVG) ─────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

// ─── Main Page ───────────────────────────────────────────────────────────────
const TOOLS = [
  { href: '/detect/text',  icon: FileText,  label: 'Text Detector',  color: 'text-amber',     bg: 'from-amber/10 to-amber/5',     desc: 'Detect ChatGPT, Claude, Gemini & more', accuracy: '94%' },
  { href: '/detect/image', icon: ImageIcon, label: 'Image Detector', color: 'text-primary',   bg: 'from-primary/10 to-primary/5', desc: 'Deepfakes, Midjourney, DALL-E, Stable Diffusion', accuracy: '97%' },
  { href: '/detect/audio', icon: Music,     label: 'Audio Detector', color: 'text-cyan',      bg: 'from-cyan/10 to-cyan/5',       desc: 'ElevenLabs, voice cloning, TTS synthesis', accuracy: '91%' },
  { href: '/detect/video', icon: Video,     label: 'Video Detector', color: 'text-secondary', bg: 'from-secondary/10 to-secondary/5', desc: 'Frame-by-frame deepfake analysis', accuracy: '88%' },
  { href: '/chat',         icon: MessageSquare, label: 'AI Assistant', color: 'text-emerald', bg: 'from-emerald/10 to-emerald/5', desc: 'Ask anything about AI detection', accuracy: 'New' },
  { href: '/batch',        icon: Database,  label: 'Batch Analyzer', color: 'text-rose',      bg: 'from-rose/10 to-rose/5',       desc: 'Analyze 20 files simultaneously', accuracy: '20x' },
]

const STATS = [
  { value: 285246, suffix: '+', label: 'Training Samples', icon: Database },
  { value: 60, suffix: '', label: 'Source Datasets', icon: Globe },
  { value: 94, suffix: '%', label: 'Text Accuracy', icon: TrendingUp },
  { value: 100, suffix: '%', label: 'Uptime SLA', icon: Award },
]

const REVIEWS = [
  { text: 'Caught an AI-written press release before we published it. Saved us massive embarrassment.', name: 'Sarah K.', role: 'Editor, News Outlet', stars: 5 },
  { text: 'The text analyzer is scary accurate. Tested it on GPT-4 output and it nailed it every time.', name: 'Marcus T.', role: 'AI Researcher', stars: 5 },
  { text: 'Best free deepfake detector I\'ve found. Clean UI and explains WHY it flagged content.', name: 'Priya M.', role: 'Content Creator', stars: 5 },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste', desc: 'Drop any image, video, audio file or paste text / a URL' },
  { n: '02', title: 'Deep AI Scan', desc: '60+ HuggingFace models analyze 20+ detection signals in seconds' },
  { n: '03', title: 'Get Full Report', desc: 'Confidence score, signal breakdown & sentence-level heatmap' },
  { n: '04', title: 'Export & Share', desc: 'Save history, share results, export PDF reports' },
]

export default function HomePage() {
  const { user, loading } = useAuth()
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, -80])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl gradient-text">DETECTAI</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            <Link href="#tools" className="hover:text-text-primary transition-colors">Tools</Link>
            <Link href="#how" className="hover:text-text-primary transition-colors">How It Works</Link>
            <Link href="/chat" className="hover:text-text-primary transition-colors flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />AI Chat
            </Link>
            <a href="https://detect-ai-nu.vercel.app/datasets/saghi776/detectai-dataset" target="_blank" rel="noopener" className="hover:text-text-primary transition-colors flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />Dataset
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {!loading && (
              user ? (
                <Link href="/dashboard" className="btn-primary px-3 sm:px-4 py-2 text-sm">Dashboard →</Link>
              ) : (
                <>
                  <Link href="/login" className="hidden sm:block text-sm text-text-muted hover:text-text-primary transition-colors">Sign in</Link>
                  <Link href="/signup" className="btn-primary px-3 sm:px-4 py-2 text-sm">Get started free</Link>
                </>
              )
            )}
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                <Link href="#tools" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                  <Cpu className="w-4 h-4" />Tools
                </Link>
                <Link href="#how" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                  <Activity className="w-4 h-4" />How It Works
                </Link>
                <Link href="/chat" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                  <MessageSquare className="w-4 h-4" />AI Chat
                </Link>
                <a href="https://detect-ai-nu.vercel.app/datasets/saghi776/detectai-dataset" target="_blank" rel="noopener"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                  <Database className="w-4 h-4" />Dataset
                </a>
                {!loading && !user && (
                  <Link href="/login" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                    <Lock className="w-4 h-4" />Sign in
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <ParticleNetwork />
        <FloatingCards />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan/5 blur-[80px] pointer-events-none" />

        <motion.div style={{ y: heroY }} className="relative z-20 text-center px-4 max-w-5xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">285,000+ training samples · Enterprise-grade AI detection</span>
            <span className="sm:hidden">285k+ samples · Open-source</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl sm:text-6xl lg:text-8xl font-black leading-[0.9] mb-6">
            <span className="gradient-text">Unmask</span>
            <br /><span className="text-text-primary">the Machine.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="text-base sm:text-xl text-text-muted max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Detect AI-generated <strong className="text-text-secondary">text</strong>, <strong className="text-text-secondary">images</strong>, <strong className="text-text-secondary">audio</strong> &amp; <strong className="text-text-secondary">video</strong> with state-of-the-art models.
            Start free. Upgrade as you grow.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16">
            <Link href={user ? '/dashboard' : '/signup'} className="btn-primary w-full sm:w-auto px-6 sm:px-8 py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/30">
              {user ? 'Open Dashboard' : 'Start Detecting Free'}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/chat" className="btn-secondary w-full sm:w-auto px-6 sm:px-8 py-3.5 text-base flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald" />Try AI Assistant
            </Link>
          </motion.div>

          {/* Live demo */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="max-w-2xl mx-auto w-full">
            <LiveDemo isLoggedIn={!!user} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 sm:py-20 border-y border-border/50 bg-surface/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STATS.map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-black gradient-text mb-2">
                  <CountUp target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-text-muted text-xs sm:text-sm font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOOLS GRID ── */}
      <section id="tools" className="py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Detection <span className="gradient-text">Arsenal</span>
            </h2>
            <p className="text-text-muted text-base sm:text-lg max-w-2xl mx-auto">
              Six powerful tools powered by proprietary multi-model AI trained on 285k+ verified samples.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {TOOLS.map((tool, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4, scale: 1.02 }} className="group cursor-pointer">
                <Link href={tool.href}>
                  <div className={`relative overflow-hidden rounded-2xl border border-border p-5 sm:p-6 bg-gradient-to-br ${tool.bg} hover:border-primary/30 transition-all duration-300 h-full`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-background/80 flex items-center justify-center ${tool.color}`}>
                        <tool.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-background/80 ${tool.color}`}>{tool.accuracy}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-text-primary mb-2 group-hover:text-white transition-colors">{tool.label}</h3>
                    <p className="text-sm text-text-muted leading-relaxed">{tool.desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-text-muted group-hover:text-primary transition-colors">
                      Try now <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI ASSISTANT PROMO ── */}
      <section className="py-16 sm:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-emerald/5 pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald/30 bg-emerald/10 text-emerald text-xs font-semibold mb-6">
                <Sparkles className="w-3.5 h-3.5" />New — AI Assistant
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6">
                Ask Anything About<br /><span className="gradient-text">AI Detection</span>
              </h2>
              <p className="text-text-muted text-base sm:text-lg mb-8 leading-relaxed">
                DETECTAI Assistant is trained on our 285k+ sample dataset. Ask it how deepfakes work, how to spot AI text, what signals give away synthetic media — or just have a conversation.
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
                {['"How do deepfakes work?"', '"Is this text AI?"', '"What is GAN fingerprinting?"', '"Explain voice cloning"'].map(q => (
                  <span key={q} className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface text-text-muted">{q}</span>
                ))}
              </div>
              <Link href="/chat" className="btn-primary px-6 sm:px-7 py-3.5 text-base inline-flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />Open AI Assistant
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="rounded-2xl border border-emerald/20 bg-surface/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-emerald/10">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-background/50">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald animate-pulse" />
                  <span className="text-sm font-semibold text-text-primary">DETECTAI Assistant</span>
                  <span className="ml-auto text-xs text-emerald font-medium">Online</span>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { role: 'user', text: 'How can I tell if an image is AI-generated?' },
                    { role: 'ai', text: 'AI-generated images have several telltale signs: unnatural textures in hair/eyes, asymmetric features, artifacts in backgrounds, and irregular lighting. Our detector analyzes 15+ signals including GAN fingerprints and diffusion patterns...' },
                    { role: 'user', text: 'What accuracy rate do you achieve?' },
                  ].map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-surface-active text-text-secondary border border-border'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-surface-active border border-border">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald"
                            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border/50">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border/50 text-text-muted text-xs">
                    <span className="flex-1">Ask about AI detection…</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-16 sm:py-24 px-4 bg-surface/20">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">How It <span className="gradient-text">Works</span></h2>
            <p className="text-text-muted text-base sm:text-lg">From upload to verdict in seconds.</p>
          </motion.div>

          <div className="relative">
            <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-secondary/30 to-transparent hidden sm:block" />
            <div className="space-y-8 sm:space-y-12">
              {HOW_IT_WORKS.map((step, i) => {
                const StepIcon = HOW_IT_WORKS_ICONS[i]
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    className={`flex items-center gap-4 sm:gap-6 ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                    <div className="flex-1 hidden lg:block" />
                    <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                      <StepIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={1.7} />
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-black text-white">
                        {i+1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">{step.title}</h3>
                      <p className="text-sm sm:text-base text-text-muted leading-relaxed">{step.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── DATASET SECTION ── */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-secondary/5 p-6 sm:p-8 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
                  <Database className="w-3.5 h-3.5" />Open Dataset · HuggingFace
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4">
                  <span className="gradient-text">285,000+</span> Training Samples
                </h2>
                <p className="text-text-muted mb-6 leading-relaxed text-sm sm:text-base">
                  Our detection models are trained on a massive open dataset collected from 60+ sources across text, image, and audio. The dataset is publicly available on HuggingFace and grows daily.
                </p>
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
                  {[
                    { label: 'AI Text', value: '156k', color: 'text-rose' },
                    { label: 'Human Text', value: '89k', color: 'text-emerald' },
                    { label: 'Media', value: '40k', color: 'text-cyan' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 sm:p-3 rounded-xl bg-background/50 border border-border/50">
                      <div className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-text-muted mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <a href="https://detect-ai-nu.vercel.app/datasets/saghi776/detectai-dataset" target="_blank" rel="noopener"
                  className="btn-secondary inline-flex items-center gap-2 text-sm">
                  <Database className="w-4 h-4 text-primary" />View Dataset on HuggingFace
                </a>
              </div>
              <div className="space-y-3">
                {[
                  { src: 'HC3, RAID, GhostBuster', type: 'AI Text', count: '45k', color: '#f43f5e' },
                  { src: 'OpenWebText, Wikipedia', type: 'Human Text', count: '38k', color: '#10b981' },
                  { src: 'FaceForensics++, DFDC', type: 'Deepfake Images', count: '15k', color: '#2563eb' },
                  { src: 'ASVspoof, ElevenLabs', type: 'Fake Audio', count: '8k', color: '#06b6d4' },
                  { src: '+ 56 more datasets', type: 'Mixed Sources', count: '179k', color: '#7c3aed' },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 p-3 rounded-xl bg-background/50 border border-border/50">
                    <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary truncate">{s.type}</div>
                      <div className="text-xs text-text-muted truncate">{s.src}</div>
                    </div>
                    <div className="text-sm font-bold text-text-secondary flex-shrink-0">{s.count}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="py-16 sm:py-20 px-4 bg-surface/20">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">What People <span className="gradient-text">Say</span></h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {REVIEWS.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="card border-border/50 hover:border-primary/20 transition-colors">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({length: r.stars}).map((_, j) => <span key={j} className="text-amber text-sm">★</span>)}
                </div>
                <p className="text-text-secondary text-sm leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
                <div>
                  <div className="text-sm font-semibold text-text-primary">{r.name}</div>
                  <div className="text-xs text-text-muted">{r.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/30">
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6">
              Start <span className="gradient-text">Unmasking</span><br />the Machine
            </h2>
            <p className="text-text-muted text-lg sm:text-xl mb-10 max-w-xl mx-auto">
              Start with 5 free scans. No credit card required. Upgrade when you're ready.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Link href={user ? '/dashboard' : '/signup'} className="btn-primary px-7 sm:px-8 py-4 text-base sm:text-lg font-bold flex items-center justify-center gap-2 shadow-2xl shadow-primary/30">
                {user ? 'Go to Dashboard' : 'Create Free Account'}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/chat" className="btn-secondary px-7 sm:px-8 py-4 text-base sm:text-lg flex items-center justify-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald" />Try AI Assistant
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
