'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { Search, Eye, Bot, CheckCircle } from 'lucide-react'

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
  const { w, h } = size
  const safeLeft = node.x < 10
    ? `max(4px, calc(${node.x}% - ${w / 2}px))`
    : node.x > 90
    ? `min(calc(100% - ${w + 4}px), calc(${node.x}% - ${w / 2}px))`
    : `calc(${node.x}% - ${w / 2}px)`
  const bobClass = index === 0
  ? '' // LCP-priority card: skip the fade/bob entrance, it was adding
       // up to ~1.5s of opacity:0->1 ramp (16% of a 5s animation +
       // staggered animation-delay) directly on top of Lighthouse's
       // measured LCP element render delay.
  : index % 2 === 0 ? 'node-card-bob-a' : 'node-card-bob-b'
  return (
    <div
      className={`absolute rounded-xl pointer-events-none overflow-hidden ${bobClass}`}
      style={{
        left: safeLeft, top: `calc(${node.y}% - ${h / 2}px)`,
        width: w, height: h, zIndex: 2,
        animationDelay: `${node.delay}s, ${node.delay}s`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}
    >
      {/*
        Was a raw <img>: Lighthouse's own throttled-mobile run displays
        this at 34x44 (the 'sm' breakpoint's cardSize) while the source
        WEBP is a fixed 130x162 — roughly 4x oversized on exactly the
        run that flagged it. next/image's `fill` + `sizes` lets Next's
        image optimizer serve a variant sized to the actual breakpoint
        instead of the full 130x162 source.
      */}
      <Image src={file} alt="" fill sizes={`${w}px`}
        priority={index === 0} className="object-cover" />
      <div className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }} />
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

export function HeroFloatingCards() {
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
