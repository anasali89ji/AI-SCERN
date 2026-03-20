'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
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
  Activity, Layers, Wand2, Star
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

// ─── Floating Nature Images (hero background trees/plants) ───────────────────
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
        fetchPriority={index < 3 ? 'high' : 'low' as 'high'|'auto'|'low'}
      />

      {/* Bottom fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

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
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3, zIndex: 1 }}>
      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b]
        const cx = (n1.x + n2.x) / 2 + (side === 'ai' ? -3 : 3)
        const cy = (n1.y + n2.y) / 2
        return (
          <motion.path key={i}
            d={`M ${n1.x}% ${n1.y}% Q ${cx}% ${cy}% ${n2.x}% ${n2.y}%`}
            stroke={color} strokeWidth="1" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.55 }}
            transition={{ delay: 0.4 + i * 0.07, duration: 1.4, ease: 'easeInOut' }}
          />
        )
      })}
      {nodes.map((n, i) => (
        <motion.circle key={i} cx={`${n.x}%`} cy={`${n.y}%`} r="2.5" fill={color}
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

  // Card sizes per breakpoint
  const cardSize = bp === 'sm' ? { w: 32, h: 42 } : bp === 'md' ? { w: 48, h: 62 } : { w: 64, h: 80 }

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
            file={`/hero/ai/ai-${String(i+1).padStart(2,'0')}.jpg`}
            side="ai" index={i} size={cardSize} />
        ))}
        {realNodes.map((node, i) => (
          <RootNetworkNode key={`real-${i}`} node={node}
            file={`/hero/real/real-${String(i+1).padStart(2,'0')}.jpg`}
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
  const [count, setCount] = useState(target)  // Start at target — always visible
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
      else setResult({ verdict: 'UNCERTAIN', confidence: 50, summary: d.error?.message || 'Try signing in for full results.' })
    } catch { setResult({ verdict: 'UNCERTAIN', confidence: 50, summary: 'Analysis unavailable. Sign in for full access.' }) }
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
          className="w-full h-24 sm:h-28 md:h-32 bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors" />

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
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-text-muted">✓ Free to use — no signup required</p>
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

// ─── Trust Bar ───────────────────────────────────────────────────────────────
const TRUST_CATS = [{ e:'📰',l:'Journalists' },{ e:'🎓',l:'Educators' },{ e:'🔒',l:'Security Teams' },{ e:'⚖️',l:'Legal Professionals' },{ e:'🏛️',l:'Researchers' },{ e:'🎨',l:'Content Creators' },{ e:'🏢',l:'HR Departments' },{ e:'📊',l:'Marketing Teams' },{ e:'🩺',l:'Healthcare Pros' }]

function TrustBar() {
  return (
    <div className="overflow-hidden py-4">
      <p className="text-center text-xs text-text-disabled uppercase tracking-widest mb-5 font-medium">Used by professionals in</p>
      <div className="flex gap-4 sm:gap-6 items-center justify-center flex-wrap">
        {TRUST_CATS.map((t) => (
          <span key={t.l} className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
            <span>{t.e}</span>{t.l}
          </span>
        ))}
      </div>
    </div>
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
  { value: 413000, suffix: '+', label: 'Samples Collected', icon: Database  },
  { value: 87,     suffix: '',  label: 'Source Datasets',   icon: Globe     },
  { value: 4,      suffix: '',  label: 'Modalities Covered',icon: Layers    },
  { value: 15,     suffix: '',  label: 'Scraper Workers',   icon: Zap       },
]

const REVIEWS = [
  { text: 'Saved us from publishing AI content. The sentence-level heatmap is incredibly useful — now part of our daily editorial workflow.', name: 'Sarah K.', role: 'Senior Editorial Staff', stars: 5, photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face&fm=webp&q=60', avatar: 'SK', color: '#6366f1' },
  { text: 'Multi-model ensemble detection gives well-rounded results across text, images, audio and video. The multimodal approach sets Aiscern apart.', name: 'Marcus T.', role: 'AI Researcher', stars: 5, photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face&fm=webp&q=60', avatar: 'MT', color: '#0ea5e9' },
  { text: 'Replaced 3 tools with just Aiscern. The batch analyser handles text, images and audio in one platform — massive cost saving.', name: 'Priya M.', role: 'Content Manager', stars: 5, photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=face&fm=webp&q=60', avatar: 'PM', color: '#10b981' },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste',  desc: 'Drop any image, video, audio file or paste text / a URL' },
  { n: '02', title: 'Deep AI Scan',     desc: 'Advanced multi-modal AI analyzes 20+ forensic signals across all content types' },
  { n: '03', title: 'Get Full Report',  desc: 'Confidence score, signal breakdown & sentence-level heatmap' },
  { n: '04', title: 'Export & Share',   desc: 'Save history, share results, export PDF reports' },
]


// ─── AI vs Real Comparison Cards ─────────────────────────────────────────────
// All images from Unsplash (free commercial license: https://unsplash.com/license)
const COMPARISON_CARDS = [
  // Text AI vs Human
  { type: 'text', label: 'AI-Generated Text',  verdict: 'AI',    confidence: 96, color: '#f43f5e',
    preview: 'The implementation of advanced machine learning algorithms has fundamentally transformed the paradigm of data processing...',
    tag: 'GPT-4', icon: 'text' },
  { type: 'text', label: 'Human Writing',       verdict: 'HUMAN', confidence: 94, color: '#10b981',
    preview: "I burned my toast again this morning. Third time this week. My smoke alarm and I have a complicated relationship at this point...",
    tag: 'Authentic', icon: 'text' },
  // Image AI vs Real
  { type: 'image', label: 'AI-Generated Portrait', verdict: 'AI',    confidence: 98, color: '#f43f5e',
    img: '/compare/ai-portrait-01.jpg',
    tag: 'Midjourney', icon: 'image' },
  { type: 'image', label: 'Authentic Photo',        verdict: 'HUMAN', confidence: 97, color: '#10b981',
    img: '/compare/real-portrait-01.jpg',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'DALL-E 3 Landscape',    verdict: 'AI',    confidence: 95, color: '#f43f5e',
    img: '/compare/ai-city-01.jpg',
    tag: 'DALL-E 3', icon: 'image' },
  { type: 'image', label: 'Real Landscape',         verdict: 'HUMAN', confidence: 93, color: '#10b981',
    img: '/compare/real-mountain-01.jpg',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'Stable Diffusion Art',  verdict: 'AI',    confidence: 99, color: '#f43f5e',
    img: '/compare/ai-abstract-01.jpg',
    tag: 'SD XL', icon: 'image' },
  { type: 'image', label: 'Real Urban Photo',       verdict: 'HUMAN', confidence: 91, color: '#10b981',
    img: '/compare/real-street-01.jpg',
    tag: 'Authentic', icon: 'image' },
  // More text
  { type: 'text', label: 'AI Essay',            verdict: 'AI',    confidence: 93, color: '#f43f5e',
    preview: 'Furthermore, the multifaceted implications of this technological advancement necessitate a comprehensive reevaluation of existing frameworks and paradigms...',
    tag: 'Claude 3', icon: 'text' },
  { type: 'text', label: 'Student Writing',     verdict: 'HUMAN', confidence: 88, color: '#10b981',
    preview: "ok so i know this essay is due tomorrow but i literally just figured out what my thesis even means. starting over at midnight feels bad but here we are lol",
    tag: 'Authentic', icon: 'text' },
  // More images
  { type: 'image', label: 'AI Nature Scene',    verdict: 'AI',    confidence: 97, color: '#f43f5e',
    img: '/compare/ai-nature-01.jpg',
    tag: 'Firefly', icon: 'image' },
  { type: 'image', label: 'Real Forest',        verdict: 'HUMAN', confidence: 95, color: '#10b981',
    img: '/compare/real-forest-01.jpg',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'AI Portrait',        verdict: 'AI',    confidence: 99, color: '#f43f5e',
    img: '/compare/ai-face-01.jpg',
    tag: 'ThisPersonDoesNotExist', icon: 'image' },
  { type: 'image', label: 'Real Portrait',      verdict: 'HUMAN', confidence: 92, color: '#10b981',
    img: '/compare/real-face-01.jpg',
    tag: 'Authentic', icon: 'image' },
  { type: 'image', label: 'AI Architecture',    verdict: 'AI',    confidence: 94, color: '#f43f5e',
    img: '/compare/ai-architecture-01.jpg',
    tag: 'Midjourney', icon: 'image' },
  { type: 'image', label: 'Real Architecture',  verdict: 'HUMAN', confidence: 96, color: '#10b981',
    img: '/compare/real-architecture-01.jpg',
    tag: 'Authentic', icon: 'image' },
  { type: 'text', label: 'AI Product Desc.',    verdict: 'AI',    confidence: 91, color: '#f43f5e',
    preview: 'Experience unparalleled innovation with our cutting-edge solution that seamlessly integrates advanced AI-powered functionality to deliver exceptional results...',
    tag: 'GPT-3.5', icon: 'text' },
  { type: 'text', label: 'Real Review',         verdict: 'HUMAN', confidence: 89, color: '#10b981',
    preview: "shipped faster than expected, packaging was a bit beat up but the actual item inside was totally fine. would buy again if the price drops",
    tag: 'Authentic', icon: 'text' },
  { type: 'image', label: 'AI Food Photo',      verdict: 'AI',    confidence: 95, color: '#f43f5e',
    img: '/compare/ai-food-01.jpg',
    tag: 'DALL-E 3', icon: 'image' },
  { type: 'image', label: 'Real Food Photo',    verdict: 'HUMAN', confidence: 93, color: '#10b981',
    img: '/compare/real-food-01.jpg',
    tag: 'Authentic', icon: 'image' },
]

function AIvsRealSection() {
  return (
    <section className="py-10 sm:py-16 lg:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

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
          <p className="text-center text-xs text-text-disabled pt-1">
            Results shown are illustrative detections
          </p>
        </div>

      </div>
    </section>
  )
}

// ── Mobile card: horizontal layout, full-width ──────────────────────────────
function ComparisonCardMobile({ card }: { card: { type: string; label: string; verdict: string; confidence: number; color: string; tag: string; preview?: string; img?: string } }) {
  const isAI = card.verdict === 'AI'
  return (
    <div className={`w-full rounded-xl border overflow-hidden flex ${isAI ? 'border-rose/20' : 'border-emerald/20'} bg-surface`}>
      {/* Left colour strip */}
      <div className={`w-1 flex-shrink-0 ${isAI ? 'bg-rose' : 'bg-emerald'}`} />

      {/* Thumbnail (image cards only) */}
      {card.type === 'image' && card.img && (
        <div className="relative w-20 h-20 flex-shrink-0 bg-surface-active self-stretch">
          <div className="absolute inset-0" style={{
            background: isAI ? 'linear-gradient(135deg,#4c1d9560,#1e1b4b40)' : 'linear-gradient(135deg,#06402060,#05201040)',
          }} />
          <img src={card.img} alt={card.label}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Text preview (text cards) */}
      {card.type === 'text' && (
        <div className="w-20 flex-shrink-0 bg-surface-active self-stretch flex items-center justify-center p-1.5">
          <span className="text-[9px] text-text-disabled leading-tight text-center line-clamp-4 italic">
            {card.preview?.slice(0, 55)}…
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary leading-tight">{card.label}</p>
          <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isAI ? 'bg-rose/10 text-rose border border-rose/20' : 'bg-emerald/10 text-emerald border border-emerald/20'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
            {card.verdict}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isAI ? 'bg-rose/10 text-rose' : 'bg-emerald/10 text-emerald'}`}>
            {card.tag}
          </span>
          <span className={`text-base font-black ${isAI ? 'text-rose' : 'text-emerald'}`}>
            {card.confidence}%
            <span className="text-[9px] text-text-disabled font-normal ml-0.5">conf</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Desktop / tablet scrolling card ─────────────────────────────────────────
function ComparisonCard({ card }: { card: { type: string; label: string; verdict: string; confidence: number; color: string; tag: string; preview?: string; img?: string } }) {
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
        <div className="text-right flex-shrink-0 ml-2">
          <div className={`text-base sm:text-lg font-black ${isAI ? 'text-rose' : 'text-emerald'}`}>{card.confidence}%</div>
          <div className="text-[9px] text-text-disabled">confidence</div>
        </div>
      </div>
    </div>
  )
}


// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading } = useAuth()
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, -80])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden w-full max-w-[100vw]">

      {/* ── Schema.org JSON-LD ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `[
        {"@context":"https://schema.org","@type":"WebApplication","@id":"https://aiscern.com/#app","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"The most accurate free AI detection platform. Detect ChatGPT text, Midjourney deepfakes, ElevenLabs voice clones. 413k+ verified samples.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"featureList":["AI Text Detection - ChatGPT Claude Gemini","Deepfake Image Detection","AI Audio Voice Clone Detection","Deepfake Video Detection","Batch Analysis","AI Detection API"],"creator":{"@type":"Person","name":"Anas Ali","url":"https://aiscern.com/about"}},
        {"@context":"https://schema.org","@type":"Organization","@id":"https://aiscern.com/#org","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png","foundingDate":"2024","contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"contact@aiscern.com"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses a multi-model ensemble approach combining RoBERTa, ViT, and wav2vec2 models. Results reflect model consensus across 413,000+ verified training samples."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern is completely free with no subscription, no credit card and no scan limits. All tools are free forever."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion and deepfake faces using a multi-model image analysis ensemble."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free REST API for AI detection. See aiscern.com/docs/api."}}]}
      ]` }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" title="Aiscern — Free AI Content Detector">
            <Image
              src="/logo.png"
              alt="Aiscern logo"
              width={36}
              height={25}
              className="object-contain drop-shadow-[0_0_6px_rgba(245,100,0,0.4)]"
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
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 sm:pt-28 lg:pt-32">
        <ParticleNetwork />
        <FloatingCards />

        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan/5 blur-[80px] pointer-events-none" />

        <div className="relative z-20 text-center px-10 sm:px-12 md:px-10 lg:px-4 max-w-[88vw] sm:max-w-lg md:max-w-2xl lg:max-w-5xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">413,000+ verified samples · Multi-model ensemble detection</span>
            <span className="sm:hidden">413k+ samples · Ensemble detection</span>
          </div>

          <motion.h1 initial={{ opacity: 1, y: 0 }} animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-4xl lg:text-7xl font-black leading-[0.95] mb-4 sm:mb-6">
            <span className="gradient-text">Unmask AI-Generated Content</span>
            <br /><span className="text-text-primary text-xl sm:text-3xl lg:text-5xl">— Free Detector for Text, Images, Audio &amp; Video</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-sm sm:text-lg text-text-muted max-w-xl mx-auto mb-6 sm:mb-10 leading-relaxed px-1">
            Detect AI-generated <strong className="text-text-secondary">text</strong>, <strong className="text-text-secondary">images</strong>, <strong className="text-text-secondary">audio</strong> &amp; <strong className="text-text-secondary">video</strong> with state-of-the-art models.
            Start free. No signup required.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16">
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
                <Link href="/detect/text" className="btn-primary w-full sm:w-auto px-6 sm:px-8 py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/30" title="Start Detecting AI Content Free">
                  Start Detecting Free <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/signup" className="btn-secondary w-full sm:w-auto px-6 sm:px-8 py-3.5 text-base flex items-center justify-center gap-2" title="Create free account">
                  <Zap className="w-5 h-5 text-amber" />Create Free Account
                </Link>
              </>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="max-w-2xl mx-auto w-full">
            <LiveDemo isLoggedIn={!!user} />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="py-8 border-b border-border/30 bg-surface/20">
        <div className="max-w-6xl mx-auto px-4">
          <TrustBar />
        </div>
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

      {/* ── AI VS REAL COMPARISON CARDS ── */}
      <AIvsRealSection />

      {/* ── TOOLS GRID ── */}
      <section id="tools" className="py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Detection <span className="gradient-text">Arsenal</span>
            </h2>
            <p className="text-text-muted text-base sm:text-lg max-w-2xl mx-auto">
              Six powerful tools powered by proprietary multi-model AI powered by 413k+ verified samples.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {TOOLS.map((tool, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4, scale: 1.02 }} className="group cursor-pointer">
                <Link href={(!user && (tool.href === "/chat" || tool.href === "/batch" || tool.href === "/scraper")) ? "/signup" : tool.href} title={tool.label}>
                  <div className={`relative overflow-hidden rounded-2xl border border-border p-5 sm:p-6 bg-gradient-to-br ${tool.bg} hover:border-primary/30 transition-all duration-300 h-full`}>
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
                <div className="flex items-center gap-3">
                  <img
                    src={r.photo}
                    alt={`${r.name} — Aiscern user review`}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  <div className="w-10 h-10 rounded-full hidden items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: r.color }}>
                    {r.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{r.name}</div>
                    <div className="text-xs text-text-muted">{r.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/reviews" className="text-sm text-primary hover:underline font-medium" title="Aiscern User Reviews">
              See all reviews →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CREDIBILITY / TRUST SIGNALS ── */}
      <section className="py-16 sm:py-20 px-4 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 block">Why people trust Aiscern</span>
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary">Built for accuracy. <span className="gradient-text">Verified by data.</span></h2>
          </div>

          {/* 4 trust pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: Database,    color: 'bg-primary/10 text-primary',   title: '413,000+ Samples', desc: 'Built on 413,000+ verified samples spanning diverse AI-generated and authentic content from 57 curated HuggingFace sources.' },
              { icon: Shield,      color: 'bg-emerald/10 text-emerald',   title: 'Research-Backed', desc: 'Built on peer-reviewed detection research. Every detection signal and methodology is validated against real-world AI outputs.' },
              { icon: TrendingUp,  color: 'bg-amber/10 text-amber',       title: 'Ensemble Models',  desc: 'Multi-model consensus using RoBERTa, ViT, and wav2vec2 ensembles — no single model makes the final call.' },
              { icon: Zap,         color: 'bg-cyan/10 text-cyan',         title: 'Free Forever',     desc: 'No subscriptions, no scan limits, no paywalls. Core detection will always be free — always.' },
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

          {/* Press / media logos as text */}
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-5">Built for professionals across</p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {TRUST_CATS.map(t => (
                <span key={t.l} className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                  <span>{t.e}</span>{t.l}
                </span>
              ))}
            </div>
          </div>

          {/* Methodology note */}
          <div className="max-w-2xl mx-auto text-center p-6 rounded-2xl border border-border/60 bg-surface/40">
            <p className="text-sm text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">How our detection works:</span> Each scan runs through Aiscern's proprietary multi-model detection engine
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
              width={90}
              height={62}
              className="mx-auto mb-8 object-contain drop-shadow-[0_0_24px_rgba(245,100,0,0.5)]"
            />
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6">
              Start <span className="gradient-text">Detecting</span><br />AI Content Free
            </h2>
            <p className="text-text-muted text-lg sm:text-xl mb-10 max-w-xl mx-auto">
              100% free, forever. No credit card, no limits, no paywalls — just detection.
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
