'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { formatVerdictConfidence } from '@/lib/utils/helpers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { SiteFooter } from '@/components/site-footer'
import { HeroHeadline } from '@/components/hero/HeroHeadline'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Shield, Brain, Eye, FileText, Globe, Zap,
  ArrowRight, CheckCircle, XCircle, HelpCircle,
  Image as ImageIcon, Video, Music, ChevronRight, Loader2,
  MessageSquare, Cpu, Lock, Database, Sparkles,
  TrendingUp, Users, Menu, X, Search,
  Scan, Bot,
  Activity, Layers, Wand2, Star, ChevronDown, FlaskConical, GraduationCap,
  Scale, ShieldCheck, Microscope, Pen, Megaphone, Heart,
} from 'lucide-react'

// ─── Sections (SSR enabled — critical for render) ────────────────────────────
// Static imports — no Suspense boundaries, no skeleton flash, no $RC JS dependency
// dynamic() caused sections to show as skeleton placeholders when JS was slow
import WhoNeedsSection from '@/components/home/WhoNeedsSection'
import AIvsRealSection from '@/components/home/AIvsRealSection'
import HomepageReviews from '@/components/home/HomepageReviews'

// Aliases for backward compat with existing JSX usage
const DynamicWhoNeedsSection = WhoNeedsSection
const DynamicAIvsRealSection = AIvsRealSection
const DynamicHomepageReviews = HomepageReviews

// ─── Canvas Particle Network ─────────────────────────────────────────────────
// ─── CSS-only Network Background (replaces canvas ParticleNetwork) ────────────
// The canvas requestAnimationFrame + filter:blur combo on mobile causes GPU
// compositing overflow → purple/blue scanline glitch artifacts on Android/iOS.
function NetworkBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/[0.03] rounded-full blur-[120px] blur-orb hidden sm:block" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/[0.03] rounded-full blur-[100px] blur-orb hidden sm:block" />
      {/* Dot grid hidden on mobile/low-power devices to prevent GPU glitches */}
        </div>
  )
}

// ─── Root Network (preserved from original) ───────────────────────────────────
const AI_NODES_LG = [
  { x: 3,  y: 12, delay: 0.00 }, { x: 14, y: 28, delay: 0.15 },
  { x: 2,  y: 46, delay: 0.30 }, { x: 18, y: 60, delay: 0.45 },
  { x: 7,  y: 76, delay: 0.60 }, { x: 28, y: 15, delay: 0.10 },
  { x: 32, y: 36, delay: 0.25 }, { x: 24, y: 54, delay: 0.40 },
  { x: 35, y: 70, delay: 0.55 }, { x: 20, y: 88, delay: 0.70 },
]
const REAL_NODES_LG = [
  { x: 96, y: 12, delay: 0.00 }, { x: 83, y: 28, delay: 0.15 },
  { x: 97, y: 46, delay: 0.30 }, { x: 79, y: 60, delay: 0.45 },
  { x: 91, y: 76, delay: 0.60 }, { x: 68, y: 15, delay: 0.10 },
  { x: 64, y: 36, delay: 0.25 }, { x: 73, y: 54, delay: 0.40 },
  { x: 62, y: 70, delay: 0.55 }, { x: 77, y: 88, delay: 0.70 },
]
const AI_EDGES_LG   = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[8,9],[1,6],[2,7],[3,8]]
const REAL_EDGES_LG = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[8,9],[1,6],[2,7],[3,8]]
const AI_NODES_MD = [
  { x: 2,  y: 10, delay: 0.00 }, { x: 12, y: 28, delay: 0.15 },
  { x: 3,  y: 50, delay: 0.30 }, { x: 15, y: 68, delay: 0.45 },
  { x: 5,  y: 82, delay: 0.60 }, { x: 22, y: 42, delay: 0.25 },
]
const REAL_NODES_MD = [
  { x: 97, y: 10, delay: 0.00 }, { x: 86, y: 28, delay: 0.15 },
  { x: 96, y: 50, delay: 0.30 }, { x: 83, y: 68, delay: 0.45 },
  { x: 93, y: 82, delay: 0.60 }, { x: 76, y: 42, delay: 0.25 },
]
const AI_EDGES_MD   = [[0,1],[1,2],[2,3],[3,4],[4,5],[0,5],[1,5]]
const REAL_EDGES_MD = [[0,1],[1,2],[2,3],[3,4],[4,5],[0,5],[1,5]]
const AI_NODES_SM   = [{ x: 1, y: 18, delay: 0.00 }, { x: 2, y: 50, delay: 0.25 }, { x: 1, y: 80, delay: 0.50 }]
const REAL_NODES_SM = [{ x: 98, y: 18, delay: 0.00 }, { x: 97, y: 50, delay: 0.25 }, { x: 98, y: 80, delay: 0.50 }]
const AI_EDGES_SM   = [[0,1],[1,2]]
const REAL_EDGES_SM = [[0,1],[1,2]]

const FLOAT_BADGES = [
  { Icon: Search, label: 'AI Text',  pct: 'Detected', color: '#2563eb', delay: 0,   pulse: true  },
  { Icon: Eye,    label: 'Deepfake', pct: 'Flagged',  color: '#2563eb', delay: 0.5, pulse: false },
]

function useBreakpoint() {
  const [bp, setBp] = useState<'sm'|'md'|'lg'|null>(null)
  useEffect(() => {
    const update = () => { const w = window.innerWidth; setBp(w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg') }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return bp ?? 'lg'
}

function RootNetworkNode({ node, file, side, index, size }: {
  node: { x: number; y: number; delay: number }
  file: string; side: 'ai' | 'real'; index: number
  size: { w: number; h: number }
}) {
  const isAI = side === 'ai'
  const { w, h } = size
  const safeLeft = node.x < 10
    ? `max(4px, calc(${node.x}% - ${w / 2}px))`
    : node.x > 90
    ? `min(calc(100% - ${w + 4}px), calc(${node.x}% - ${w / 2}px))`
    : `calc(${node.x}% - ${w / 2}px)`
  const bobClass = index % 2 === 0 ? 'node-card-bob-a' : 'node-card-bob-b'
  return (
    <div
      className={`absolute rounded-xl pointer-events-none overflow-hidden ${bobClass}`}
      style={{
        left: safeLeft, top: `calc(${node.y}% - ${h / 2}px)`,
        width: w, height: h, zIndex: 2,
        animationDelay: `${node.delay}s, ${node.delay}s`,
        boxShadow: isAI ? '0 4px 24px rgba(37,99,235,0.12)' : '0 4px 24px rgba(16,185,129,0.08)',
      }}
    >
      <div className="absolute inset-0" style={{
        background: isAI ? '#1e3a8a' : '#052e16',
      }} />
      <img src={file} alt="" decoding="async"
        className="absolute inset-0 w-full h-full object-cover" style={{ display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        loading={index < 2 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : 'low'}
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className={`absolute bottom-1 left-1 text-[7px] font-black px-1 py-0.5 rounded leading-none z-10 ${isAI ? 'bg-rose/80 text-white' : 'bg-emerald/80 text-white'}`}>
        {isAI ? 'AI' : '✓'}
      </div>
      <div className="absolute inset-0 rounded-xl"
        style={{ boxShadow: isAI ? 'inset 0 0 0 1px rgba(37,99,235,0.3)' : 'inset 0 0 0 1px rgba(16,185,129,0.3)' }} />
    </div>
  )
}

function RootNetworkSVG({ nodes, edges, color, side }: {
  nodes: { x: number; y: number }[]; edges: number[][]; color: string; side: 'ai' | 'real'
}) {
  const reduced = useReducedMotion()
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.25, zIndex: 1 }}>
      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b]
        const cx = (n1.x + n2.x) / 2 + (side === 'ai' ? -3 : 3), cy = (n1.y + n2.y) / 2
        return reduced ? (
          <path key={i} d={`M ${n1.x} ${n1.y} Q ${cx} ${cy} ${n2.x} ${n2.y}`}
            stroke={color} strokeWidth="0.4" fill="none" strokeLinecap="round" opacity={0.6} />
        ) : (
          <motion.path key={i} d={`M ${n1.x} ${n1.y} Q ${cx} ${cy} ${n2.x} ${n2.y}`}
            stroke={color} strokeWidth="0.4" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{ delay: 0.4 + i * 0.07, duration: 1.4, ease: 'easeInOut' }}
          />
        )
      })}
      {nodes.map((n, i) => (
        reduced ? (
          <circle key={i} cx={n.x} cy={n.y} r="1.0" fill={color} opacity={0.5} />
        ) : (
          <motion.circle key={i} cx={n.x} cy={n.y} r="1.0" fill={color}
            initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ delay: 0.7 + i * 0.08, duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )
      ))}
    </svg>
  )
}

function FloatingCards() {
  const bp = useBreakpoint()
  const aiNodes   = bp === 'sm' ? AI_NODES_SM   : bp === 'md' ? AI_NODES_MD   : AI_NODES_LG
  const realNodes = bp === 'sm' ? REAL_NODES_SM : bp === 'md' ? REAL_NODES_MD : REAL_NODES_LG
  const aiEdges   = bp === 'sm' ? AI_EDGES_SM   : bp === 'md' ? AI_EDGES_MD   : AI_EDGES_LG
  const realEdges = bp === 'sm' ? REAL_EDGES_SM : bp === 'md' ? REAL_EDGES_MD : REAL_EDGES_LG
  const cardSize  = bp === 'sm' ? { w: 34, h: 44 } : bp === 'md' ? { w: 48, h: 60 } : { w: 64, h: 80 }
  const badgePositions = bp === 'sm'
    ? [{ x: '28%', y: '6%' }, { x: '54%', y: '6%' }]
    : [{ x: '22%', y: '7%' }, { x: '66%', y: '7%' }]
  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <RootNetworkSVG nodes={aiNodes}   edges={aiEdges}   color="#2563eb" side="ai"   />
        <RootNetworkSVG nodes={realNodes} edges={realEdges} color="#10b981" side="real" />
        {aiNodes.map((node, i) => (
          <RootNetworkNode key={`ai-${i}`} node={node}
            file={`/hero/ai/ai-${String(i+1).padStart(2,'0')}.webp`}
            side="ai" index={i} size={cardSize} />
        ))}
        {realNodes.map((node, i) => (
          <RootNetworkNode key={`real-${i}`} node={node}
            file={`/hero/real/real-${String(i+1).padStart(2,'0')}.webp`}
            side="real" index={i} size={cardSize} />
        ))}
        <motion.div className="absolute hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full border border-rose/25 bg-rose/8"
          style={{ top: 72, left: 8 }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 0.75, x: 0 }} transition={{ delay: 1.4, duration: 0.6 }}>
          <Bot className="w-2.5 h-2.5 text-rose" />
          <span className="text-[8px] font-bold text-rose/80 uppercase tracking-wide hidden md:inline">AI Generated</span>
        </motion.div>
        <motion.div className="absolute hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full border border-emerald/25 bg-emerald/8"
          style={{ top: 72, right: 8 }} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 0.75, x: 0 }} transition={{ delay: 1.4, duration: 0.6 }}>
          <CheckCircle className="w-2.5 h-2.5 text-emerald" />
          <span className="text-[8px] font-bold text-emerald/80 uppercase tracking-wide hidden md:inline">Authentic</span>
        </motion.div>
      </div>
      {FLOAT_BADGES.map((item, i) => {
        const Icon = item.Icon; const pos = badgePositions[i]
        return (
          <motion.div key={i}
            className="absolute hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border select-none"
            style={{ left: pos.x, top: pos.y, zIndex: 10, background: `${item.color}12`, borderColor: `${item.color}30` }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: [0, -5, 0] }}
            transition={{ opacity: { delay: item.delay + 1.0, duration: 0.5 }, y: { delay: item.delay, duration: 3.5, repeat: Infinity, ease: 'easeInOut' } }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}22`, color: item.color }}>
              <Icon className="w-3 h-3" strokeWidth={2} />
            </div>
            <div className="hidden md:block">
              <div className="text-[8px] font-medium leading-none mb-0.5" style={{ color: `${item.color}bb` }}>{item.label}</div>
              <div className="text-[10px] font-bold text-white leading-none">{item.pct}</div>
            </div>
            {item.pulse && (
              <motion.div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: item.color }}
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
            )}
          </motion.div>
        )
      })}
    </>
  )
}

// ─── CountUp ────────────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (animated) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated) return
      setAnimated(true)
      let start = 0
      const steps = 60; const step = target / steps
      const interval = setInterval(() => {
        start += step
        if (start >= target) { setCount(target); clearInterval(interval) }
        else setCount(Math.floor(start))
      }, 1600 / steps)
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, animated])
  return <span ref={ref} className="counter-value">{count.toLocaleString()}{suffix}</span>
}

// ─── Live Demo ────────────────────────────────────────────────────────────────
function LiveDemo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const analyze = async () => {
    if (text.length < 50) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: null }),
      })
      if (res.status === 401) { router.push('/signup'); setLoading(false); return }
      const d = await res.json()
      if (d.success) { setResult(d.result) }
      else setResult({ verdict: 'UNCERTAIN', summary: d.error?.message || 'Try signing in for full results.' })
    } catch { setResult({ verdict: 'UNCERTAIN', summary: 'Analysis unavailable. Sign in for full access.' }) }
    setLoading(false)
  }
  const examples = [
    { label: 'AI text',    text: 'The intersection of artificial intelligence and human creativity presents a fascinating paradox in contemporary discourse. As machine learning models become increasingly sophisticated in generating coherent, contextually appropriate text, the boundaries between human and algorithmic authorship continue to blur in unprecedented ways.' },
    { label: 'Human text', text: "I spent all weekend trying to fix my leaky faucet and honestly I have no idea what I'm doing. Watched like 6 YouTube videos and still made it worse. Water is now shooting sideways. My neighbor thinks it's hilarious. Calling a plumber tomorrow. RIP my bank account." },
  ]
  return (
    <div className="relative">
      <div className="rounded-2xl border border-primary/20 bg-surface p-4 sm:p-5 shadow-2xl shadow-primary/5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald" />
            </span>
            <span className="text-sm font-bold text-text-primary">Live AI Detector</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald/10 text-emerald font-semibold border border-emerald/20">Free</span>
          </div>
          <div className="flex gap-2">
            {examples.map(ex => (
              <button key={ex.label} onClick={() => setText(ex.text)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border hover:border-primary/40 text-text-muted hover:text-primary transition-all min-h-0">
                {ex.label}
              </button>
            ))}
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste any text to detect if it's AI-generated… (min 50 characters)"
          className="w-full min-w-0 h-24 sm:h-28 bg-background/80 border border-border rounded-xl px-3 sm:px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <span className="text-xs text-text-muted">{text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '· ready ✓'}</span>
          <button onClick={analyze} disabled={loading || text.length < 50}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2 min-h-[36px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Scanning…' : 'Analyze Free'}
          </button>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className={`rounded-xl border p-4 ${result.verdict === 'AI' ? 'bg-rose/5 border-rose/20' : result.verdict === 'HUMAN' ? 'bg-emerald/5 border-emerald/20' : 'bg-amber/5 border-amber/20'}`}>
                <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {result.verdict === 'AI' ? <XCircle className="w-5 h-5 text-rose shrink-0" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-5 h-5 text-emerald shrink-0" /> : <HelpCircle className="w-5 h-5 text-amber shrink-0" />}
                    <span className={`font-bold text-base leading-tight ${result.verdict === 'AI' ? 'text-rose' : result.verdict === 'HUMAN' ? 'text-emerald' : 'text-amber'}`}>
                      {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-text-primary tabular-nums">{formatVerdictConfidence(result.confidence || 0, result.verdict)}</div>
                    <div className="text-[10px] text-text-muted">confidence</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-background overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence <= 1 ? result.confidence * 100 : result.confidence}%` }}
                    transition={{ duration: 1.0, ease: 'easeOut' }}
                    className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-rose' : result.verdict === 'HUMAN' ? 'bg-emerald' : 'bg-amber'}`} />
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-text-muted">✓ Free · Sign in to save results</p>
                  <Link href="/detect/text" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                    Full text detector <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Spotlight Card ───────────────────────────────────────────────────────────
function SpotlightCard({ children, className = '', color = 'rgba(37,99,235,0.12)' }: {
  children: React.ReactNode; className?: string; color?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    ref.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }, [])
  return (
    <div ref={ref} onMouseMove={onMouseMove}
      className={`spotlight-card ${className}`}
      style={{ '--spotlight-color': color } as React.CSSProperties}>
      {children}
    </div>
  )
}

// ─── Nav scroll behavior ──────────────────────────────────────────────────────
function useNavScrollBehavior() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      if (y > lastY.current + 10 && y > 100) setHidden(true)
      else if (y < lastY.current - 5) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return { scrolled, hidden }
}

// ─── Scroll indicator ─────────────────────────────────────────────────────────
function HeroScrollIndicator() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 100) setHidden(true) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (hidden) return null
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 animate-bounce opacity-30 pointer-events-none">
      <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Scroll</span>
      <ChevronDown className="w-4 h-4 text-text-muted" />
    </div>
  )
}

// ─── Constants ───────────────────────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

const TOOLS = [
  { href: '/detect/text',  icon: FileText,      label: 'Free AI Text Detector',           color: 'text-amber',     bg: 'bg-amber/8',          border: 'border-amber/25',     desc: 'Detect ChatGPT, Claude, Gemini & more',           accuracy: '~94%', accent: '#f59e0b' },
  { href: '/detect/image', icon: ImageIcon,     label: 'Deepfake Image Detector',         color: 'text-primary',   bg: 'bg-primary/8',      border: 'border-primary/25',   desc: 'Deepfakes, Midjourney, DALL-E, Stable Diffusion', accuracy: '~98%', accent: '#2563eb' },
  { href: '/detect/audio', icon: Music,         label: 'AI Audio & Voice Clone Detector', color: 'text-cyan',      bg: 'bg-cyan/8',            border: 'border-cyan/25',      desc: 'ElevenLabs, voice cloning, TTS synthesis',        accuracy: '~91%', accent: '#06b6d4' },
  { href: '/detect/video', icon: Video,         label: 'Free Deepfake Video Detector',    color: 'text-violet-400',bg: 'bg-violet-500/8',border: 'border-violet-500/25',desc: 'Frame-by-frame deepfake analysis',                accuracy: '~88%', accent: '#8b5cf6' },
  { href: '/chat',         icon: MessageSquare, label: 'AI Detection Assistant',          color: 'text-emerald',   bg: 'from-emerald/20 via-emerald/8 to-transparent',      border: 'border-emerald/25',   desc: 'Ask anything about AI detection',                 accuracy: 'New',  accent: '#10b981' },
  { href: '/batch',        icon: Database,      label: 'Batch AI Content Analyser',       color: 'text-rose',      bg: 'from-rose/20 via-rose/8 to-transparent',            border: 'border-rose/25',      desc: 'Analyze 20 files simultaneously',                 accuracy: '20x',  accent: '#f43f5e' },
]

const STATS = [
  { value: 4,  suffix: '',  label: 'Modalities Covered', icon: Layers   },
  { value: 8,  suffix: '+', label: 'Detection Models',   icon: Brain    },
  { value: 85, suffix: '%', label: 'Text Accuracy (~)',  icon: FileText },
  { value: 79, suffix: '%', label: 'Audio Accuracy (~)', icon: Zap      },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste',   desc: 'Drop any image, video, audio file or paste text / a URL' },
  { n: '02', title: 'Ensemble Analysis', desc: 'Advanced multi-modal AI analyzes 20+ detection signals across all content types' },
  { n: '03', title: 'Get Full Report',   desc: 'Confidence score, signal breakdown & sentence-level heatmap' },
  { n: '04', title: 'Export & Share',    desc: 'Save history, share results, export PDF reports' },
]

const TRUST_FEATURES = [
  { icon: Database,   color: 'text-primary', bg: 'bg-primary/8', border: 'border-primary/20', title: 'Benchmarked Datasets', desc: 'Models evaluated against curated public datasets spanning diverse AI-generated and authentic content from multiple sources.', large: true,  stat: '2.2', statSuffix: 'M+', statLabel: 'training samples', accent: '#2563eb' },
  { icon: Shield,     color: 'text-emerald', bg: 'from-emerald/18 to-transparent', border: 'border-emerald/20', title: 'Research-Backed',       desc: 'Built on peer-reviewed detection research. Every signal validated against real-world AI outputs.',                         large: false, stat: '8',   statSuffix: '+',  statLabel: 'papers cited',    accent: '#10b981' },
  { icon: TrendingUp, color: 'text-amber',   bg: 'from-amber/18 to-transparent',   border: 'border-amber/20',   title: 'Ensemble Models',       desc: 'Multi-model consensus using RoBERTa, ViT, and wav2vec2 — no single model makes the final call.',                        large: false, stat: '20',  statSuffix: '+',  statLabel: 'signals analyzed', accent: '#f59e0b' },
  { icon: Zap,        color: 'text-cyan',    bg: 'from-cyan/18 to-transparent',     border: 'border-cyan/20',    title: 'Free Tier Available',   desc: 'Start detecting AI content for free — no credit card required. Upgrade when you need more scans.',                        large: false, stat: 'Free', statSuffix: '', statLabel: 'to start',        accent: '#06b6d4' },
]

const PROFESSIONALS = [
  { label: 'Journalists',      icon: Pen         },
  { label: 'Educators',        icon: GraduationCap },
  { label: 'HR Teams',         icon: Users       },
  { label: 'Legal Pros',       icon: Scale       },
  { label: 'Security Teams',   icon: ShieldCheck },
  { label: 'Researchers',      icon: Microscope  },
  { label: 'Content Creators', icon: Megaphone   },
  { label: 'Marketing Teams',  icon: TrendingUp  },
  { label: 'Healthcare',       icon: Heart       },
]

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const reduced = useReducedMotion()
  const { scrolled, hidden } = useNavScrollBehavior()

  // iOS scroll lock — prevent body scrolling while mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow  = 'hidden'
      document.body.style.position  = 'fixed'
      document.body.style.width     = '100%'
    } else {
      document.body.style.overflow  = ''
      document.body.style.position  = ''
      document.body.style.width     = ''
    }
    return () => {
      document.body.style.overflow  = ''
      document.body.style.position  = ''
      document.body.style.width     = ''
    }
  }, [mobileNavOpen])
  const [datasetRows, setDatasetRows] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/dataset-stats')
      .then(r => r.json())
      .then(d => { if (d.rows) setDatasetRows(d.rows) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden w-full max-w-[100vw]">

      {/* Schema JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `[
        {"@context":"https://schema.org","@type":"WebApplication","@id":"https://aiscern.com/#app","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble-based AI content detection platform for text, images, audio, and video. Free tier available. Published accuracy benchmarks.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"featureList":["AI Text Detection - ChatGPT Claude Gemini","Deepfake Image Detection","AI Audio Voice Clone Detection","Deepfake Video Detection","Batch Analysis","AI Detection API"],"creator":{"@type":"Person","name":"Anas Ali","url":"https://aiscern.com/about"}},
        {"@context":"https://schema.org","@type":"Organization","@id":"https://aiscern.com/#org","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png","foundingDate":"2025","contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"contact@aiscern.com"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses a 14-layer ensemble combining ViT classifiers, RoBERTa, wav2vec2, and physics-based signal analysis (Bayer demosaicing, polarization, subsurface scattering, sensor QE matching). Benchmarked accuracy: text ~94% (F1 0.965, AUC 0.98), image ~98% (AUC 0.98, 14 layers), audio ~91% (AUC 0.95), video ~88% (AUC 0.93). See /benchmarks for full results."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free tier with 10 scans per day on text and image detection. No credit card required. Pro plans available for audio, video, and higher limits."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion, SDXL, FLUX, Gemini, and Grok images using a 14-layer ensemble including physics-based Bayer pattern analysis (L12-BDIS) with 100% recall across all major generators."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a REST API available on Team and Enterprise plans. See aiscern.com/docs/api."}}]}
      ]` }} />

      {/* ══ NAV ══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300
        ${hidden ? 'nav-hidden' : 'nav-visible'}
        ${scrolled
          ? 'border-b border-primary/10 bg-[#08080d]/95 sm:bg-background/88 sm:backdrop-blur-2xl shadow-lg shadow-black/20'
          : 'border-b border-transparent bg-[#08080d]/90 sm:bg-background/60 sm:backdrop-blur-xl'
        }`}>
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto h-full px-4 sm:px-6 2xl:px-10 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group" title="Aiscern — Free AI Content Detector">
            <span className="font-black text-xl gradient-text">Aiscern</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            {[['#tools','Tools'],['#how','How It Works']].map(([href, label]) => (
              <a key={href} href={href} className="relative hover:text-text-primary transition-colors duration-200 group">
                {label}
                <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-300 rounded-full" />
              </a>
            ))}
            <Link href={user ? "/chat" : "/signup"} className="relative hover:text-text-primary transition-colors duration-200 group flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />AI Chat
              <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-emerald group-hover:w-full transition-all duration-300 rounded-full" />
            </Link>
            {[['/ reviews','Reviews',''],['/ blog','Blog',''],['/ pricing','Pricing','']].map(([href, label]) => (
              <Link key={label} href={href.replace(/ /g,'')} className="relative hover:text-text-primary transition-colors duration-200 group">
                {label}
                <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-300 rounded-full" />
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-all duration-200 group">
                <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                  {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                </span>
                <span className="hidden sm:inline">Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/60 text-sm font-semibold text-text-primary hover:bg-surface-hover hover:border-primary/30 transition-all duration-200">
                  Sign In
                </Link>
                <Link href="/signup" className="relative overflow-hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold bg-primary hover:bg-primary/90 transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Join</span>
                </Link>
              </>
            )}
            <button className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel">
              <AnimatePresence mode="wait" initial={false}>
                {mobileNavOpen
                  ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.div>
                  : <motion.div key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="w-5 h-5" /></motion.div>
                }
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              id="mobile-nav-panel"
              role="dialog"
              aria-label="Navigation menu"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden border-t border-white/5 bg-[#08080d] overflow-hidden"
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && setMobileNavOpen(false)}>
              <div className="px-4 py-4 flex flex-col gap-1">
                {[
                  { href: '#tools', label: 'Tools', Icon: Cpu },
                  { href: '#how', label: 'How It Works', Icon: Activity },
                  { href: user ? '/chat' : '/signup', label: 'AI Detection Assistant', Icon: MessageSquare },
                  { href: '/reviews', label: 'Reviews', Icon: Star },
                  { href: '/blog', label: 'Blog', Icon: FileText },
                  { href: '/pricing', label: 'Pricing', Icon: Zap },
                ].map((link, i) => (
                  <motion.div key={link.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link href={link.href} onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                      <link.Icon className="w-4 h-4" />{link.label}
                    </Link>
                  </motion.div>
                ))}
                {!loading && !user && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/40">
                    <Link href="/login" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium">
                      <Lock className="w-4 h-4" />Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setMobileNavOpen(false)} className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-white text-sm font-bold bg-primary hover:bg-primary/90">
                      <Zap className="w-4 h-4" />Get Started Free
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main id="main-content">

        {/* ══ HERO ══ */}
        <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 sm:pt-28 lg:pt-32 pb-12 sm:pb-20">

          {/* Animated mesh gradients */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true"></div>
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.7 }}>
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-2xl opacity-60"
                    style={{ background: 'radial-gradient(circle, rgba(245,100,0,0.5) 0%, transparent 70%)' }} />
                  <Image src="/logo.png" alt="Aiscern" width={68} height={80}
                    className="relative object-contain h-16 sm:h-20 2xl:h-24 w-auto drop-shadow-[0_0_28px_rgba(245,100,0,0.55)]" />
                </div>
              </div>

              <h2 className="text-4xl sm:text-6xl 2xl:text-7xl font-black mb-6 leading-tight">
                Start <span className="gradient-text">Detecting</span><br />AI Content Free
              </h2>
              <p className="text-text-muted text-lg sm:text-xl 2xl:text-2xl mb-10 max-w-xl 2xl:max-w-2xl mx-auto leading-relaxed">
                Core features free — no credit card required. No account needed for basic scans.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link href={user ? '/dashboard' : '/detect/text'}
                  className="group relative overflow-hidden btn-primary px-8 py-4 text-base sm:text-lg font-bold flex items-center justify-center gap-2 shadow-2xl shadow-primary/30">
                  {user ? 'Go to Dashboard' : 'Start Detecting AI Content Free'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/signup" className="btn-secondary px-8 py-4 text-base sm:text-lg flex items-center justify-center gap-2 hover:border-primary/30">
                  <Sparkles className="w-5 h-5 text-amber" />Create Free Account
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs 2xl:text-sm text-text-muted">
                {['No credit card required', 'Free tier always available', 'No account for basic scans'].map(t => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald" />{t}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  )
}
