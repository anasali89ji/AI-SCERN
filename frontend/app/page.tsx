'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth }           from '@/components/auth-provider'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { SiteFooter } from '@/components/site-footer'
import {
  Shield, Brain, Eye, Mic, FileText, Globe, Zap, BarChart3,
  ArrowRight, CheckCircle, XCircle, HelpCircle,
  Image as ImageIcon, Video, Music, ChevronRight, Loader2,
  MessageSquare, Cpu, Lock, Database, AlertTriangle, Sparkles,
  TrendingUp, Users, Award, Play, Menu, X, Search,
  Scan, Fingerprint, Waves, Dna, Bot, Radio,
  Activity, Layers, Wand2, Star, ChevronDown
} from 'lucide-react'

// ─── Canvas Particle Network (decorative, non-blocking) ─────────────────────
function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number
    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
    const isMobile = W < 640
    // Mobile: reduce node count AND connection distance for huge TBT savings
    const NODES = isMobile ? 12 : 40
    const DIST  = isMobile ? 100 : 140
    const nodes = Array.from({ length: NODES }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: 1.5 + Math.random() * 1.5,
      pulse: Math.random() * Math.PI * 2,
    }))

    function draw() {
      // Pause when tab hidden — saves battery + main-thread
      if (document.hidden) { animId = requestAnimationFrame(draw); return }
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
          if (dist < DIST) {
            const alpha = (1 - dist / DIST) * 0.18
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
  return <canvas ref={canvasRef} aria-hidden="true" role="presentation" className="absolute inset-0 w-full h-full pointer-events-none opacity-60" />
}

// ─── Floating Nature Images (hero background trees/plants) ───────────────────
// ── Deferred Particle Network — only starts after LCP ──────────────────────
function DeferredParticleNetwork() {
  const [show, setShow] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return  // skip animation for users who prefer reduced motion
    const t = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(t)
  }, [reduced])
  return show ? <ParticleNetwork /> : null
}

// ── Hero Root Network — responsive 3-tier (mobile 3+3 / tablet 6+6 / desktop 10+10) ──

// ── Desktop nodes (full 10+10) ──
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

// ── Tablet nodes (6+6, avoid centre x:28-42 and x:58-72) ──
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

// ── Mobile nodes (3+3, tight to edges only) ──
const AI_NODES_SM = [
  { x: 1,  y: 18, delay: 0.00 },
  { x: 2,  y: 50, delay: 0.25 },
  { x: 1,  y: 80, delay: 0.50 },
]
const REAL_NODES_SM = [
  { x: 98, y: 18, delay: 0.00 },
  { x: 97, y: 50, delay: 0.25 },
  { x: 98, y: 80, delay: 0.50 },
]
const AI_EDGES_SM   = [[0,1],[1,2]]
const REAL_EDGES_SM = [[0,1],[1,2]]

const FLOAT_BADGES = [
  { Icon: Search, label: 'AI Text',  pct: 'Detected', color: '#7c3aed', delay: 0,   pulse: true  },
  { Icon: Eye,    label: 'Deepfake', pct: 'Flagged',  color: '#2563eb', delay: 0.5, pulse: false },
]

// ── Responsive hook ──────────────────────────────────────────────────────────
function useBreakpoint() {
  // Start null to avoid SSR/hydration mismatch
  const [bp, setBp] = useState<'sm'|'md'|'lg'|null>(null)
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setBp(w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg')
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return bp ?? 'lg'  // fallback to lg until client detects real size
}

function RootNetworkNode({ node, file, side, index, size }: {
  node: { x: number; y: number; delay: number }
  file: string; side: 'ai' | 'real'; index: number
  size: { w: number; h: number }
}) {
  const isAI = side === 'ai'
  const { w, h } = size

  // Clamp to never go off-screen
  const safeLeft = node.x < 10
    ? `max(4px, calc(${node.x}% - ${w / 2}px))`
    : node.x > 90
    ? `min(calc(100% - ${w + 4}px), calc(${node.x}% - ${w / 2}px))`
    : `calc(${node.x}% - ${w / 2}px)`

  // Alternate bob speed/height for organic look
  const bobClass = index % 2 === 0 ? 'node-card-bob-a' : 'node-card-bob-b'

  return (
    <div
      className={`absolute rounded-lg pointer-events-none overflow-hidden ${bobClass}`}
      style={{
        left:  safeLeft,
        top:   `calc(${node.y}% - ${h / 2}px)`,
        width: w,
        height: h,
        zIndex: 2,
        // Stagger each card's animation start by its delay
        animationDelay: `${node.delay}s, ${node.delay}s`,
      }}
    >
      {/* Solid colour fallback — always visible */}
      <div className="absolute inset-0" style={{
        background: isAI
          ? 'linear-gradient(160deg,#5b21b6,#1e1b4b)'
          : 'linear-gradient(160deg,#065f46,#052e16)',
      }} />

      {/* Image sits on top — opacity:1, no JS state, no race */}
      <img
        src={file}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        decoding="async"
        loading={index < 2 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : 'low'}
      />

      {/* 40% black overlay so images are subtle background elements */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Bottom fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {/* Label */}
      <div className={`absolute bottom-1 left-1 text-[7px] font-black px-1 py-0.5 rounded leading-none z-10 ${isAI ? 'bg-rose/80 text-white' : 'bg-emerald/80 text-white'}`}>
        {isAI ? 'AI' : '✓'}
      </div>

      {/* Border */}
      <div className="absolute inset-0 rounded-lg"
        style={{ boxShadow: isAI ? 'inset 0 0 0 1px #7c3aed50' : 'inset 0 0 0 1px #10b98150' }} />
    </div>
  )
}

function RootNetworkSVG({ nodes, edges, color, side }: {
  nodes: { x: number; y: number }[]
  edges: number[][]
  color: string; side: 'ai' | 'real'
}) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ opacity: 0.3, zIndex: 1 }}
    >
      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b]
        const cx = (n1.x + n2.x) / 2 + (side === 'ai' ? -3 : 3)
        const cy = (n1.y + n2.y) / 2
        return (
          <motion.path key={i}
            d={`M ${n1.x} ${n1.y} Q ${cx} ${cy} ${n2.x} ${n2.y}`}
            stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.55 }}
            transition={{ delay: 0.4 + i * 0.07, duration: 1.4, ease: 'easeInOut' }}
          />
        )
      })}
      {nodes.map((n, i) => (
        <motion.circle key={i} cx={n.x} cy={n.y} r="1.2" fill={color}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.75, 0.35] }}
          transition={{ delay: 0.7 + i * 0.08, duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  )
}

function FloatingCards() {
  const bp = useBreakpoint()

  // Choose node set by breakpoint
  const aiNodes   = bp === 'sm' ? AI_NODES_SM   : bp === 'md' ? AI_NODES_MD   : AI_NODES_LG
  const realNodes = bp === 'sm' ? REAL_NODES_SM : bp === 'md' ? REAL_NODES_MD : REAL_NODES_LG
  const aiEdges   = bp === 'sm' ? AI_EDGES_SM   : bp === 'md' ? AI_EDGES_MD   : AI_EDGES_LG
  const realEdges = bp === 'sm' ? REAL_EDGES_SM : bp === 'md' ? REAL_EDGES_MD : REAL_EDGES_LG

  // Card sizes per breakpoint — smaller, more subtle background elements
  const cardSize = bp === 'sm' ? { w: 34, h: 44 } : bp === 'md' ? { w: 48, h: 60 } : { w: 62, h: 78 }

  // Badge positions change per breakpoint
  const badgePositions = bp === 'sm'
    ? [{ x: '28%', y: '6%' }, { x: '54%', y: '6%' }]
    : [{ x: '22%', y: '7%' }, { x: '66%', y: '7%' }]

  return (
    <>
      {/* Root network — visible on ALL screen sizes */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <RootNetworkSVG nodes={aiNodes}   edges={aiEdges}   color="#7c3aed" side="ai"   />
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

        {/* Side labels — hide on xs phones */}
        <motion.div
          className="absolute hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full border border-rose/25 bg-rose/8 backdrop-blur-sm"
          style={{ top: 72, left: 8 }}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 0.75, x: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <Bot className="w-2.5 h-2.5 text-rose" />
          <span className="text-[8px] font-bold text-rose/80 uppercase tracking-wide hidden md:inline">AI Generated</span>
        </motion.div>
        <motion.div
          className="absolute hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full border border-emerald/25 bg-emerald/8 backdrop-blur-sm"
          style={{ top: 72, right: 8 }}
          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 0.75, x: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <CheckCircle className="w-2.5 h-2.5 text-emerald" />
          <span className="text-[8px] font-bold text-emerald/80 uppercase tracking-wide hidden md:inline">Authentic</span>
        </motion.div>
      </div>

      {/* Detection badges — 2 on desktop, 2 smaller on tablet, hidden on mobile */}
      {FLOAT_BADGES.map((item, i) => {
        const Icon = item.Icon
        const pos  = badgePositions[i]
        return (
          <motion.div key={i}
            className="absolute hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border backdrop-blur-xl select-none"
            style={{
              left: pos.x, top: pos.y, zIndex: 10,
              background: `${item.color}12`,
              borderColor: `${item.color}30`,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: [0, -5, 0] }}
            transition={{
              opacity: { delay: item.delay + 1.0, duration: 0.5 },
              y: { delay: item.delay, duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${item.color}22`, color: item.color }}>
              <Icon className="w-3 h-3" strokeWidth={2} />
            </div>
            <div className="hidden md:block">
              <div className="text-[8px] font-medium leading-none mb-0.5" style={{ color: `${item.color}bb` }}>{item.label}</div>
              <div className="text-[10px] font-bold text-white leading-none">{item.pct}</div>
            </div>
            {item.pulse && (
              <motion.div className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                style={{ background: item.color }}
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }} />
            )}
          </motion.div>
        )
      })}
    </>
  )
}

// ─── Live Counter ───────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)  // Start at 0, animate when visible
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (animated) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated) return
      setAnimated(true)
      let start = 0
      const duration = 1600
      const steps = 60
      const step = target / steps
      const interval = setInterval(() => {
        start += step
        if (start >= target) { setCount(target); clearInterval(interval) }
        else setCount(Math.floor(start))
      }, duration / steps)
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, animated])

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
    // Open access — no signup gate
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: null }),
      })
      if (res.status === 401) { router.push('/signup'); setLoading(false); return }
      const d = await res.json()
      if (d.success) { setResult(d.result); setUsed(true) }
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
          className="w-full min-w-0 h-24 sm:h-28 md:h-32 bg-background border border-border rounded-xl px-3 sm:px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors" />

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
                <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {result.verdict === 'AI' ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose shrink-0" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald shrink-0" /> : <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber shrink-0" />}
                    <span className={`font-bold text-sm sm:text-lg leading-tight ${result.verdict === 'AI' ? 'text-rose' : result.verdict === 'HUMAN' ? 'text-emerald' : 'text-amber'}`}>
                      {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-black text-text-primary tabular-nums">{Math.round(result.confidence || 0)}%</div>
                    <div className="text-[10px] sm:text-xs text-text-muted">confidence</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence || 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-rose' : result.verdict === 'HUMAN' ? 'bg-emerald' : 'bg-amber'}`} />
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-text-muted">✓ Free to use · Sign in to save results</p>
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

// ─── Who Needs Aiscern — Card Section ────────────────────────────────────────
// ─── Who Needs Aiscern — enriched data ───────────────────────────────────────
const WHO_NEEDS = [
  {
    role: 'Journalists & Fact-Checkers',
    icon: Globe,
    img: '/trust/journalists.jpg',
    tag: 'Media & Press',
    tagColor: '#7c3aed',
    problem: 'AI-fabricated quotes, deepfake press photos and synthetic sources arriving faster than ever.',
    value: 'Verify every image, audio clip and statement before it publishes — in under 10 seconds.',
    stats: [{ label: 'Image verification', value: '~82%' }, { label: 'Audio deepfake', value: '~79%' }],
    href: '/detect/image',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.22)',
  },
  {
    role: 'Educators & Schools',
    icon: Award,
    img: '/trust/educators.jpg',
    tag: 'Education',
    tagColor: '#2563eb',
    problem: 'Students submitting ChatGPT essays — academic integrity eroding class by class.',
    value: 'Sentence-level AI heatmaps and confidence scores catch generated text other tools miss.',
    stats: [{ label: 'Text detection', value: '~85%' }, { label: 'Avg scan time', value: '<3s' }],
    href: '/detect/text',
    color: '#2563eb',
    glow: 'rgba(37,99,235,0.22)',
  },
  {
    role: 'HR & Recruiters',
    icon: Users,
    img: '/trust/hr.jpg',
    tag: 'Talent & Hiring',
    tagColor: '#0891b2',
    problem: 'AI-polished CVs and cover letters that mask the real candidate behind perfect prose.',
    value: 'Screen written applications and video-interview transcripts for synthetic content before hiring.',
    stats: [{ label: 'CV text scan', value: '~85%' }, { label: 'Video analysis', value: '~76%' }],
    href: '/detect/text',
    color: '#0891b2',
    glow: 'rgba(8,145,178,0.22)',
  },
  {
    role: 'Legal Professionals',
    icon: Shield,
    img: '/trust/legal.jpg',
    tag: 'Law & Compliance',
    tagColor: '#059669',
    problem: 'Deepfake evidence, AI-drafted contracts and forged audio recordings entering proceedings.',
    value: 'Detection reports for documents, images and audio — shareable with one link. Results are probabilistic; use alongside human judgment.',
    stats: [{ label: 'Audio detection', value: '~79%' }, { label: 'Image analysis', value: '~82%' }],
    href: '/detect/audio',
    color: '#059669',
    glow: 'rgba(5,150,105,0.22)',
  },
  {
    role: 'Security & Trust & Safety',
    icon: Lock,
    img: '/trust/security.jpg',
    tag: 'Cybersecurity',
    tagColor: '#dc2626',
    problem: 'Voice-cloned fraud calls, synthetic ID photos and AI-generated phishing content at scale.',
    value: 'Batch-scan hundreds of files simultaneously — text, image, audio and video in one queue.',
    stats: [{ label: 'Batch capacity', value: '20×' }, { label: 'Voice clone det.', value: '~79%' }],
    href: '/batch',
    color: '#dc2626',
    glow: 'rgba(220,38,38,0.22)',
  },
  {
    role: 'Content Creators',
    icon: Sparkles,
    img: '/trust/creators.jpg',
    tag: 'Creative Work',
    tagColor: '#d97706',
    problem: 'Clients doubting originality while competitors flood feeds with AI-generated content.',
    value: 'Authenticate your work with a shareable proof-of-authenticity link — instantly and free.',
    stats: [{ label: 'Multi-modal', value: '4 types' }, { label: 'Shareable report', value: '1-click' }],
    href: '/detect/image',
    color: '#d97706',
    glow: 'rgba(217,119,6,0.22)',
  },
  {
    role: 'Academic Researchers',
    icon: Brain,
    img: '/trust/researchers.jpg',
    tag: 'Research & Science',
    tagColor: '#7c3aed',
    problem: 'AI-generated papers, hallucinated citations and synthetic datasets corrupting research.',
    value: 'Validate source material and peer submissions using methodology-backed multi-model detection.',
    stats: [{ label: 'Text accuracy', value: '~85%' }, { label: 'Datasets used', value: '87' }],
    href: '/methodology',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.22)',
  },
  {
    role: 'Marketing & Brand Teams',
    icon: TrendingUp,
    img: '/trust/marketing.jpg',
    tag: 'Brand Safety',
    tagColor: '#2563eb',
    problem: 'UGC campaigns flooded with AI images, fake reviews and synthetic testimonials harming trust.',
    value: 'Audit every piece of user-generated content before it goes live — protect brand credibility.',
    stats: [{ label: 'Image detection', value: '~82%' }, { label: 'Batch UGC scan', value: '20×' }],
    href: '/detect/image',
    color: '#2563eb',
    glow: 'rgba(37,99,235,0.22)',
  },
  {
    role: 'Healthcare Professionals',
    icon: Activity,
    img: '/trust/healthcare.jpg',
    tag: 'Medicine & Health',
    tagColor: '#059669',
    problem: 'AI-fabricated medical reports, synthetic scans and health misinformation spreading fast.',
    value: 'Verify medical documents, imagery and audio records across all four modalities — free.',
    stats: [{ label: 'Multi-modal', value: '4 types' }, { label: 'Confidence score', value: 'Full' }],
    href: '/detect/image',
    color: '#059669',
    glow: 'rgba(5,150,105,0.22)',
  },
]

function WhoNeedsCard({ card, i }: { card: typeof WHO_NEEDS[0]; i: number }) {
  const CardIcon = card.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: i * 0.04, duration: 0.5, ease: 'easeOut' }}
      className="group relative flex flex-col rounded-2xl overflow-hidden border border-white/8 hover:border-white/18 transition-all duration-500 hover:-translate-y-1.5"
      style={{
        boxShadow: `0 0 0 1px ${card.color}18, 0 2px 12px rgba(0,0,0,0.3)`,
      }}
    >
      {/* ── Image panel ── */}
      <div className="relative h-36 sm:h-40 overflow-hidden flex-shrink-0">

        {/* Layer 1 — colour fallback (shown only when image fails to load) */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(145deg, ${card.color}60, ${card.color}25)` }}
        />

        {/* Layer 2 — actual photo, Next/Image for auto WebP/AVIF + responsive sizing */}
        <Image
          src={card.img}
          alt={card.role}
          fill
          className="object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          quality={72}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />

        {/* Layer 3 — subtle colour tint overlay (lets image show through) */}
        <div
          className="absolute inset-0"
          style={{ background: `${card.color}28` }}
        />

        {/* Layer 4 — bottom vignette for text legibility only — NOT full cover */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Layer 5 — top accent shimmer bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${card.color}, transparent)` }}
        />

        {/* Tag badge — top left, above all layers */}
        <div className="absolute top-2.5 left-3 z-10">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${card.color}70`, color: '#fff' }}
          >
            <CardIcon className="w-2.5 h-2.5" />
            {card.tag}
          </span>
        </div>

        {/* Hover colour glow from bottom */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(ellipse at 50% 120%, ${card.glow} 0%, transparent 65%)` }}
        />

        {/* Role title — pinned to bottom, above vignette */}
        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3 z-10">
          <h3 className="text-[13px] sm:text-sm font-black text-white leading-snug drop-shadow-lg">
            {card.role}
          </h3>
        </div>
      </div>

      {/* ── Content panel ── */}
      <div className="bg-surface/96 backdrop-blur-sm flex flex-col flex-1 p-3.5 sm:p-4 gap-3">

        {/* Problem row */}
        <div className="flex gap-2.5 items-start">
          <div className="w-5 h-5 rounded-lg bg-rose/12 border border-rose/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-2.5 h-2.5 text-rose" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-rose/60 uppercase tracking-widest mb-0.5">The Problem</p>
            <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{card.problem}</p>
          </div>
        </div>

        {/* Separator */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border/50" />
          <div className="w-1 h-1 rounded-full" style={{ background: card.color }} />
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Solution row */}
        <div className="flex gap-2.5 items-start">
          <div className="w-5 h-5 rounded-lg bg-emerald/12 border border-emerald/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle className="w-2.5 h-2.5 text-emerald" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-emerald/60 uppercase tracking-widest mb-0.5">Aiscern Solves It</p>
            <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{card.value}</p>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex gap-1.5 flex-wrap min-w-0">
          {card.stats.map(s => (
            <span key={s.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black"
              style={{ background: `${card.color}12`, border: `1px solid ${card.color}25`, color: card.color }}>
              <span className="font-black">{s.value}</span>
              <span className="font-medium opacity-70">· {s.label}</span>
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href={card.href}
          aria-label={`Start free AI detection for ${card.role}`}
          className="mt-auto flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 group/btn hover:brightness-110"
          style={{
            background: `${card.color}14`,
            border: `1px solid ${card.color}30`,
            color: card.color,
          }}
        >
          <span className="font-black">Try free</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}

function WhoNeedsSection() {
  return (
    <section className="relative py-16 sm:py-24 lg:py-32 px-5 sm:px-8 lg:px-12 bg-background border-b border-border/40 overflow-hidden">
      {/* Subtle bg glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full bg-primary/4 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-secondary/4 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-[11px] sm:text-xs font-black uppercase tracking-widest mb-5">
            <Users className="w-3 h-3" />
            Who Uses Aiscern
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight">
            Used by Professionals <span className="gradient-text">Across Industries</span>
          </h2>

          <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            <strong className="text-text-secondary">AI-generated content</strong> is a problem in every field.
            Aiscern gives professionals detection tools to identify it —{' '}
            <strong className="text-primary">free tier available</strong>, across all four modalities.
          </p>

          {/* Quick industry count row */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {['Media', 'Education', 'Legal', 'HR', 'Security', 'Research', 'Healthcare', 'Marketing'].map(tag => (
              <span key={tag} className="text-[10px] sm:text-xs font-semibold text-text-muted px-2.5 py-1 rounded-full border border-border/50 hover:border-primary/30 hover:text-primary transition-all duration-200 cursor-default">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Card grid: 1→2→3 cols ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
          {WHO_NEEDS.map((card, i) => (
            <WhoNeedsCard key={card.role} card={card} i={i} />
          ))}
        </div>

        {/* ── Bottom CTA strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Link href="/detect/text"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] transition-all duration-200">
            <Brain className="w-4 h-4" />
            Start Free Scan
          </Link>
          <Link href="/methodology"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-sm font-semibold text-text-muted hover:border-primary/40 hover:text-text-primary transition-all duration-200">
            <Eye className="w-4 h-4" />
            See How It Works
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// ─── How It Works Icons ───────────────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

// ─── Constants ───────────────────────────────────────────────────────────────
const TOOLS = [
  { href: '/detect/text',  icon: FileText,     label: 'Free AI Text Detector',        color: 'text-amber',     bg: 'from-amber/10 to-amber/5',         desc: 'Detect ChatGPT, Claude, Gemini & more', accuracy: '~85%' },
  { href: '/detect/image', icon: ImageIcon,    label: 'Deepfake Image Detector',      color: 'text-primary',   bg: 'from-primary/10 to-primary/5',     desc: 'Deepfakes, Midjourney, DALL-E, Stable Diffusion', accuracy: '~82%' },
  { href: '/detect/audio', icon: Music,        label: 'AI Audio & Voice Clone Detector', color: 'text-cyan',  bg: 'from-cyan/10 to-cyan/5',           desc: 'ElevenLabs, voice cloning, TTS synthesis', accuracy: '~79%' },
  { href: '/detect/video', icon: Video,        label: 'Free Deepfake Video Detector', color: 'text-secondary', bg: 'from-secondary/10 to-secondary/5', desc: 'Frame-by-frame deepfake analysis', accuracy: '~76%' },
  { href: '/chat',         icon: MessageSquare,label: 'AI Detection Assistant',       color: 'text-emerald',   bg: 'from-emerald/10 to-emerald/5',     desc: 'Ask anything about AI detection', accuracy: 'New' },
  { href: '/batch',        icon: Database,     label: 'Batch AI Content Analyser',   color: 'text-rose',      bg: 'from-rose/10 to-rose/5',           desc: 'Analyze 20 files simultaneously', accuracy: '20x' },
]

const STATS = [
  { value: 4,      suffix: '',   label: 'Modalities Covered',  icon: Layers    },
  { value: 8,      suffix: '+',  label: 'Detection Models',    icon: Brain     },
  { value: 85,     suffix: '%',  label: 'Text Accuracy (~)',   icon: FileText  },
  { value: 79,     suffix: '%',  label: 'Audio Accuracy (~)',  icon: Zap       },
]



const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste',  desc: 'Drop any image, video, audio file or paste text / a URL' },
  { n: '02', title: 'Ensemble Analysis',     desc: 'Advanced multi-modal AI analyzes 20+ detection signals across all content types' },
  { n: '03', title: 'Get Full Report',  desc: 'Confidence score, signal breakdown & sentence-level heatmap' },
  { n: '04', title: 'Export & Share',   desc: 'Save history, share results, export PDF reports' },
]


// ─── AI vs Real Comparison Cards ─────────────────────────────────────────────
// All images from Unsplash (free commercial license: https://unsplash.com/license)
const COMPARISON_CARDS = [
  // Text AI vs Human
  { type: 'text', label: 'AI-Generated Text',  verdict: 'AI', color: '#f43f5e',
    preview: 'The implementation of advanced machine learning algorithms has fundamentally transformed the paradigm of data processing...',
    tag: 'GPT-4', icon: 'text' },
  { type: 'text', label: 'Human Writing',       verdict: 'HUMAN', color: '#10b981',
    preview: "I burned my toast again this morning. Third time this week. My smoke alarm and I have a complicated relationship at this point...",
    tag: 'Authentic', icon: 'text' },
  // Image AI vs Real
  { type: 'image', label: 'AI-Generated Portrait', verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-portrait-01.webp',
    tag: 'Midjourney', icon: 'image' },
  { type: 'image', label: 'Authentic Photo',        verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-portrait-01.webp',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'DALL-E 3 Landscape',    verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-city-01.webp',
    tag: 'DALL-E 3', icon: 'image' },
  { type: 'image', label: 'Real Landscape',         verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-mountain-01.webp',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'Stable Diffusion Art',  verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-abstract-01.webp',
    tag: 'SD XL', icon: 'image' },
  { type: 'image', label: 'Real Urban Photo',       verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-street-01.webp',
    tag: 'Authentic', icon: 'image' },
  // More text
  { type: 'text', label: 'AI Essay',            verdict: 'AI', color: '#f43f5e',
    preview: 'Furthermore, the multifaceted implications of this technological advancement necessitate a comprehensive reevaluation of existing frameworks and paradigms...',
    tag: 'Claude 3', icon: 'text' },
  { type: 'text', label: 'Student Writing',     verdict: 'HUMAN', color: '#10b981',
    preview: "ok so i know this essay is due tomorrow but i literally just figured out what my thesis even means. starting over at midnight feels bad but here we are lol",
    tag: 'Authentic', icon: 'text' },
  // More images
  { type: 'image', label: 'AI Nature Scene',    verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-nature-01.webp',
    tag: 'Firefly', icon: 'image' },
  { type: 'image', label: 'Real Forest',        verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-forest-01.webp',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'AI Portrait',        verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-face-01.webp',
    tag: 'ThisPersonDoesNotExist', icon: 'image' },
  { type: 'image', label: 'Real Portrait',      verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-face-01.webp',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'AI Architecture',    verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-architecture-01.webp',
    tag: 'Midjourney', icon: 'image' },
  { type: 'image', label: 'Real Architecture',  verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-architecture-01.webp',
    tag: 'Authentic', icon: 'image' },
  { type: 'text', label: 'AI Product Desc.',    verdict: 'AI', color: '#f43f5e',
    preview: 'Experience unparalleled innovation with our cutting-edge solution that seamlessly integrates advanced AI-powered functionality to deliver exceptional results...',
    tag: 'GPT-3.5', icon: 'text' },
  { type: 'text', label: 'Real Review',         verdict: 'HUMAN', color: '#10b981',
    preview: "shipped faster than expected, packaging was a bit beat up but the actual item inside was totally fine. would buy again if the price drops",
    tag: 'Authentic', icon: 'text' },
  { type: 'image', label: 'AI Food Photo',      verdict: 'AI', color: '#f43f5e',
    img: '/compare/ai-food-01.webp',
    tag: 'DALL-E 3', icon: 'image' },
  { type: 'image', label: 'Real Food Photo',    verdict: 'HUMAN', color: '#10b981',
    img: '/compare/real-food-01.webp',
    tag: 'Authentic', icon: 'image' },
]

function LazyAIvsRealSection() {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: '400px' }  // start loading 400px before it enters viewport
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ minHeight: visible ? 'auto' : '400px' }}>
      {visible && <AIvsRealSection />}
    </div>
  )
}

function AIvsRealSection() {
  return (
    <section className="py-10 sm:py-16 lg:py-24 overflow-hidden">
      <div className="max-w-7xl 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 2xl:px-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose/30 bg-rose/5 text-rose text-[11px] sm:text-xs font-semibold mb-3">
            <Scan className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            Real-World Detection Examples
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black mb-3">
            AI vs <span className="gradient-text">Authentic</span>
          </h2>
          <p className="text-text-muted text-sm sm:text-base lg:text-lg max-w-xl mx-auto px-2">
            See how Aiscern tells AI-generated content apart from authentic human work.
          </p>
        </motion.div>

        {/* ── ALL SCREENS: auto-scrolling rows (mobile gets smaller cards) ── */}
        <div className="space-y-2 sm:space-y-3">
          {/* Row 1 — scrolls left */}
          <div className="relative overflow-hidden">
            <div className="flex gap-2 sm:gap-3 animate-scroll-left" style={{ width: 'max-content' }}>
              {[...COMPARISON_CARDS.slice(0, 10), ...COMPARISON_CARDS.slice(0, 10)].map((card, i) => (
                <ComparisonCard key={i} card={card} />
              ))}
            </div>
            <div className="absolute left-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          </div>
          {/* Row 2 — scrolls right */}
          <div className="relative overflow-hidden">
            <div className="flex gap-2 sm:gap-3 animate-scroll-right" style={{ width: 'max-content' }}>
              {[...COMPARISON_CARDS.slice(10), ...COMPARISON_CARDS.slice(10)].map((card, i) => (
                <ComparisonCard key={i} card={card} />
              ))}
            </div>
            <div className="absolute left-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          </div>
          <p className="text-center text-xs text-text-muted pt-2">⚠️ Illustrative examples — not real detection results. Try the live detector above.</p>
        </div>

      </div>
    </section>
  )
}

// ── Mobile card: horizontal layout, full-width ──────────────────────────────
// ── Desktop / tablet scrolling card ─────────────────────────────────────────
function ComparisonCard({ card }: { card: { type: string; label: string; verdict: string; color: string; tag: string; preview?: string; img?: string } }) {
  const isAI = card.verdict === 'AI'
  return (
    <div className="flex-shrink-0 w-60 sm:w-64 lg:w-72 bg-surface border border-border rounded-xl sm:rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 group">
      {/* Top — image or text */}
      {card.type === 'image' && card.img ? (
        <div className="relative h-28 sm:h-36 lg:h-44 overflow-hidden bg-surface-active">
          <div className="absolute inset-0" style={{
            background: isAI ? 'linear-gradient(135deg,#4c1d9580,#1e1b4b50)' : 'linear-gradient(135deg,#064e3b80,#052e1650)',
          }} />
          <img src={card.img} alt={card.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-10"
            loading="lazy"
            width={288}
            height={176}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-20" />
          <div className={`absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white backdrop-blur-sm ${isAI ? 'bg-rose/80 border border-rose/40' : 'bg-emerald/80 border border-emerald/40'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {card.verdict}
          </div>
        </div>
      ) : (
        <div className="h-28 sm:h-36 lg:h-44 p-2 sm:p-4 bg-surface-active flex flex-col justify-center relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1 h-full ${isAI ? 'bg-rose' : 'bg-emerald'}`} />
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-4 italic pl-3">
            "{card.preview}"
          </p>
          <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isAI ? 'bg-rose/10 text-rose border border-rose/20' : 'bg-emerald/10 text-emerald border border-emerald/20'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
            {card.verdict}
          </div>
        </div>
      )}
      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-sm font-semibold text-text-primary truncate">{card.label}</p>
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${isAI ? 'bg-rose/10 text-rose' : 'bg-emerald/10 text-emerald'}`}>
            {card.tag}
          </span>
        </div>
        <div className="flex-shrink-0 ml-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAI ? 'bg-rose/10 text-rose border border-rose/20' : 'bg-emerald/10 text-emerald border border-emerald/20'}`}>
            {isAI ? '⚠ AI' : '✓ Real'}
          </span>
        </div>
      </div>
    </div>
  )
}



// ─── HomepageReviews — live data from /api/reviews ───────────────────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#2563eb)',
  'linear-gradient(135deg,#0ea5e9,#06b6d4)',
  'linear-gradient(135deg,#10b981,#16a34a)',
  'linear-gradient(135deg,#f43f5e,#dc2626)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#8b5cf6,#6d28d9)',
]

function HomepageReviews() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reviews?page=1&sort=top&limit=3')
      .then(r => r.json())
      .then(d => { if (d.data?.length) setReviews(d.data.slice(0, 3)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
      {[0,1,2].map(i => (
        <div key={i} className="card border-border/50 h-40 animate-pulse bg-surface/60 rounded-2xl" />
      ))}
    </div>
  )

  if (!reviews.length) return null

  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      {reviews.map((r: any, i: number) => (
        <motion.div key={r.id || i}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: i * 0.1 }}
          className="card border-border/50 hover:border-primary/20 transition-colors">
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: r.rating || r.stars || 5 }).map((_: unknown, j: number) => (
              <span key={j} className="text-amber text-sm">★</span>
            ))}
          </div>
          <p className="text-text-secondary text-sm leading-relaxed mb-4">
            &ldquo;{r.body || r.text}&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
            >
              {r.is_anonymous ? '?' : (r.display_name?.charAt(0) || 'U').toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">
                {r.is_anonymous ? 'Anonymous' : (r.display_name || 'Aiscern User')}
              </div>
              <div className="text-xs text-text-muted">{r.tool_used || 'Aiscern User'}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Hero Scroll Indicator ────────────────────────────────────────────────────
function HeroScrollIndicator() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 100) setHidden(true) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (hidden) return null
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 animate-bounce opacity-40 hover:opacity-70 transition-opacity pointer-events-none">
      <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Scroll</span>
      <ChevronDown className="w-4 h-4 text-text-muted" />
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const reduced = useReducedMotion()

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden w-full max-w-[100vw]">

      {/* ── Schema.org JSON-LD ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `[
        {"@context":"https://schema.org","@type":"WebApplication","@id":"https://aiscern.com/#app","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble-based AI content detection platform for text, images, audio, and video. Free tier available. Published accuracy benchmarks.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"featureList":["AI Text Detection - ChatGPT Claude Gemini","Deepfake Image Detection","AI Audio Voice Clone Detection","Deepfake Video Detection","Batch Analysis","AI Detection API"],"creator":{"@type":"Person","name":"Anas Ali","url":"https://aiscern.com/about"}},
        {"@context":"https://schema.org","@type":"Organization","@id":"https://aiscern.com/#org","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png","foundingDate":"2025","contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"contact@aiscern.com"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses an ensemble approach combining RoBERTa, ViT, and wav2vec2 models. Current benchmarked accuracy: text ~85%, image ~82%, audio ~79%, video ~76%. See /methodology for details."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free tier with 10 scans per day on text and image detection. No credit card required. Pro plans available for audio, video, and higher limits."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion and deepfake faces using a multi-model image analysis ensemble."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a REST API available on Team and Enterprise plans. See aiscern.com/docs/api."}}]}
      ]` }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto h-full px-4 sm:px-6 2xl:px-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" title="Aiscern — Free AI Content Detector">
            <Image
              src="/logo.png"
              alt="Aiscern logo"
              width={24}
              height={28}
              className="object-contain h-6 sm:h-7 w-auto drop-shadow-[0_0_6px_rgba(245,100,0,0.4)]"
              priority
            />
            <span className="font-black text-xl gradient-text">Aiscern</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            <Link href="#tools" className="hover:text-text-primary transition-colors">Tools</Link>
            <Link href="#how"   className="hover:text-text-primary transition-colors">How It Works</Link>
            <Link href={user ? "/chat" : "/signup"} className="hover:text-text-primary transition-colors flex items-center gap-1" title="AI Detection Assistant">
              <MessageSquare className="w-3.5 h-3.5" />AI Chat
            </Link>
            <Link href="/reviews" className="hover:text-text-primary transition-colors" title="Aiscern User Reviews">Reviews</Link>
            <Link href="/blog" className="hover:text-text-primary transition-colors" title="Aiscern Blog">Blog</Link>
            <Link href="/pricing" className="hover:text-text-primary transition-colors" title="View AI Detector Plans">Pricing</Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-all group">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0 ring-2 ring-primary/30">
                  {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                </span>
                <span className="hidden sm:inline">Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-hover hover:border-primary/40 transition-all">
                  Sign In
                </Link>
                <Link href="/signup" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Join</span>
                </Link>
              </>
            )}
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
                <Link href="#tools"    onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium"><Cpu className="w-4 h-4" />Tools</Link>
                <Link href="#how"      onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium"><Activity className="w-4 h-4" />How It Works</Link>
                <Link href={user ? "/chat" : "/signup"} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium"><MessageSquare className="w-4 h-4" />AI Detection Assistant</Link>
                <Link href="/reviews"  onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium"><Star className="w-4 h-4" />Reviews</Link>
                <Link href="/blog" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium"><FileText className="w-4 h-4" />Blog</Link>
                <Link href="/pricing"  onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium"><Zap className="w-4 h-4" />View AI Detector Plans</Link>
                {!loading && !user && (
                  <>
                    <Link href="/login" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all text-sm font-medium w-full"><Lock className="w-4 h-4" />Sign In</Link>
                    <Link href="/signup" onClick={() => setMobileNavOpen(false)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold mt-1 w-full"><Zap className="w-4 h-4" />Get Started Free</Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main id="main-content">
      {/* ── HERO ── */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-20 sm:pt-28 lg:pt-32 pb-16 sm:pb-20">
        <DeferredParticleNetwork />
        <FloatingCards />

        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan/5 blur-[80px] pointer-events-none" />

        <div className="relative z-20 text-center px-5 sm:px-8 md:px-10 lg:px-4 max-w-[92vw] sm:max-w-lg md:max-w-2xl lg:max-w-5xl mx-auto w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border border-primary/40 bg-primary/15 text-primary text-[11px] sm:text-xs font-semibold mb-4 sm:mb-6">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Ensemble of 8+ detection models · Text, Image, Audio, Video</span>
            <span className="sm:hidden">8+ models · Free tier available</span>
          </div>

          <h1 className="font-black leading-[0.95] mb-4 sm:mb-6">
            {/* Mobile: short punchy headline */}
            <span className="block sm:hidden text-[2rem] leading-tight gradient-text">Aiscern</span>
            <span className="block sm:hidden text-lg text-text-primary mt-2 font-semibold leading-snug">
              Text · Images · Audio · Video
            </span>
            {/* Desktop: full headline */}
            <span className="hidden sm:block text-4xl lg:text-7xl gradient-text">Detect AI-Generated Content</span>
            <span className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 text-2xl lg:text-4xl font-black mt-3 leading-snug">
              <span className="text-amber font-black">Text</span>
              <span className="text-text-muted font-light">·</span>
              <span className="text-primary font-black">Images</span>
              <span className="text-text-muted font-light">·</span>
              <span className="text-cyan font-black">Audio</span>
              <span className="text-text-muted font-light">·</span>
              <span className="text-secondary font-black">Video</span>
              <span className="text-text-secondary font-semibold ml-1">Across Four Modalities</span>
            </span>
          </h1>

          <p className="text-sm sm:text-lg text-text-secondary max-w-xl mx-auto mb-6 sm:mb-10 leading-relaxed hero-fade-up" style={{ animationDelay: '0.05s' }}>
            <span className="sm:hidden">Ensemble-based AI detection. <strong className="text-text-primary">Free tier available.</strong> No account required for basic scans.</span>
            <span className="hidden sm:inline">Detect AI-generated <strong className="text-amber">text</strong>, <strong className="text-primary">images</strong>, <strong className="text-cyan">audio</strong> &amp; <strong className="text-secondary">video</strong> using an ensemble of detection models. Core features free during early access. No account required for basic scans.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 mb-8 sm:mb-16 hero-fade-up" style={{ animationDelay: '0.1s' }}>
            {user ? (
              <>
                <Link href="/dashboard"
                  className="group relative w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-base font-bold flex items-center justify-center gap-3 shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:scale-[1.02] transition-all duration-200 overflow-hidden"
                  title="Go to your Aiscern dashboard">
                  <span className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-white/10 to-violet-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm flex-shrink-0">
                    {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                  </span>
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/chat"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-border bg-surface/60 backdrop-blur-sm text-base font-semibold flex items-center justify-center gap-2 hover:border-primary/50 hover:bg-surface transition-all duration-200"
                  title="AI Detection Assistant">
                  <MessageSquare className="w-5 h-5 text-emerald" />ARIA Assistant
                </Link>
              </>
            ) : (
              <>
                <Link href="/detect/text" className="btn-primary w-full sm:w-auto px-5 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/30" title="Start Detecting AI Content Free">
                  Start Free Scan <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
                <Link href="/signup" className="btn-secondary w-full sm:w-auto px-5 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base flex items-center justify-center gap-2" title="Create free account">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber" />Create Free Account
                </Link>
              </>
            )}
          </div>

          <div className="max-w-2xl 2xl:max-w-3xl mx-auto w-full hero-fade-up" style={{ animationDelay: '0.18s' }}>
            <LiveDemo isLoggedIn={!!user} />
          </div>

          <HeroScrollIndicator />
        </div>
      </section>

      {/* ── WHO NEEDS AISCERN ── */}
      <div className="cv-auto"><WhoNeedsSection /></div>

      {/* ── STATS ── */}
      <section className="cv-auto py-10 sm:py-20 border-y border-border/50 bg-surface/30">
        <div className="max-w-6xl 2xl:max-w-[1300px] mx-auto px-4 2xl:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STATS.map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="text-center">
                <div className="text-[2rem] sm:text-4xl lg:text-5xl font-black gradient-text mb-1.5 tabular-nums">
                  <CountUp target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-text-secondary text-xs sm:text-sm font-medium mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI VS REAL COMPARISON CARDS — lazy loaded below fold ── */}
      <div className="cv-auto"><LazyAIvsRealSection /></div>

      {/* ── TOOLS GRID ── */}
      <section id="tools" className="cv-auto py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Detection <span className="gradient-text">Tools</span>
            </h2>
            <p className="text-text-muted text-base sm:text-lg max-w-2xl mx-auto">
              Six detection tools powered by an ensemble of open-source and fine-tuned models, benchmarked on public datasets.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {TOOLS.map((tool, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                whileHover={reduced ? undefined : { y: -4, scale: 1.02 }} className="group cursor-pointer">
                <Link href={(!user && (tool.href === "/chat" || tool.href === "/batch" || tool.href === "/scraper")) ? "/signup" : tool.href} title={tool.label}>
                  <div className={`relative overflow-hidden rounded-2xl border border-border p-4 sm:p-6 bg-gradient-to-br ${tool.bg} hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-background/80 flex items-center justify-center ${tool.color}`}>
                        <tool.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-background/80 ${tool.color}`}>{tool.accuracy}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">{tool.label}</h3>
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

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="cv-auto py-16 sm:py-24 px-4 bg-surface/20">
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

      <section className="py-16 sm:py-20 px-4 bg-surface/20">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">Early <span className="gradient-text">Feedback</span></h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">We are collecting real feedback from beta testers. If you have used Aiscern, we would love to hear from you.</p>
          </motion.div>
          <HomepageReviews />
          <div className="text-center mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="mailto:contact@aiscern.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/40 bg-primary/8 text-sm font-semibold text-primary hover:bg-primary/15 transition-all">
              Share Your Feedback
            </a>
            <Link href="/reviews" className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium" title="Aiscern User Reviews">
              See all reviews →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CREDIBILITY / TRUST SIGNALS ── */}
      <section className="py-16 sm:py-20 px-4 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary">Built for accuracy. <span className="gradient-text">Benchmarked on public datasets.</span></h2>
          </div>

          {/* 4 trust pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: Database,    color: 'bg-primary/10 text-primary',   title: 'Benchmarked Datasets', desc: 'Models evaluated against curated public datasets spanning diverse AI-generated and authentic content from multiple sources.' },
              { icon: Shield,      color: 'bg-emerald/10 text-emerald',   title: 'Research-Backed', desc: 'Built on peer-reviewed detection research. Every detection signal and methodology is validated against real-world AI outputs.' },
              { icon: TrendingUp,  color: 'bg-amber/10 text-amber',       title: 'Ensemble Models',  desc: 'Multi-model consensus using RoBERTa, ViT, and wav2vec2 ensembles — no single model makes the final call.' },
              { icon: Zap,         color: 'bg-cyan/10 text-cyan',         title: 'Free Tier Available', desc: 'Core detection features are free during early access. No account needed for basic scans. Upgrade for audio, video, and API access.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-6 space-y-3 hover:border-primary/30 transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-text-primary">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Professionals list — clean, no emojis */}
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-5">Built for professionals across</p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {['Journalists','Educators','HR Teams','Legal Pros','Security Teams','Researchers','Content Creators','Marketing Teams','Healthcare'].map(name => (
                <span key={name} className="text-sm font-medium text-text-muted px-3 py-1 rounded-full border border-border/60 hover:border-primary/40 hover:text-text-primary transition-colors">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Methodology note */}
          <div className="max-w-2xl mx-auto text-center p-6 rounded-2xl border border-border/60 bg-surface/40">
            <p className="text-sm text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">How our detection works:</span> Each scan runs through Aiscern's ensemble of open-source and fine-tuned detection models
              plus 7–10 deterministic signal extractors (perplexity, burstiness, spectral entropy, GAN artifacts).
              Weights adapt in real time — if a model is unavailable, its weight redistributes to the remaining models.
              Final verdict requires ≥62% confidence to label AI, ≤38% for Human.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Image
              src="/logo.png"
              alt="Aiscern"
              width={68}
              height={80}
              className="mx-auto mb-8 object-contain h-16 sm:h-20 w-auto drop-shadow-[0_0_24px_rgba(245,100,0,0.5)]"
            />
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6">
              Start <span className="gradient-text">Detecting</span><br />AI Content Free
            </h2>
            <p className="text-text-muted text-lg sm:text-xl mb-10 max-w-xl mx-auto">
              Core features free during early access. No account required for basic scans.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Link href={user ? '/dashboard' : '/detect/text'} className="btn-primary px-7 sm:px-8 py-4 text-base sm:text-lg font-bold flex items-center justify-center gap-2 shadow-2xl shadow-primary/30" title="Start Detecting AI Content Free">
                {user ? 'Go to Dashboard' : 'Start Detecting AI Content Free'}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/signup" className="btn-secondary px-7 sm:px-8 py-4 text-base sm:text-lg flex items-center justify-center gap-2" title="Create free Aiscern account">
                <Zap className="w-5 h-5 text-amber" />Create Free Account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      </main>
      <SiteFooter />
    </div>
  )
}
