'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const ROTATING_WORDS = ['Text', 'Image', 'Audio', 'Video'] as const

const WORD_STYLES = {
  Text:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
  Image: { color: '#3b82f6', glow: 'rgba(59,130,246,0.15)' },
  Audio: { color: '#8b5cf6', glow: 'rgba(139,92,246,0.15)' },
  Video: { color: '#10b981', glow: 'rgba(16,185,129,0.15)' },
} as const

const INTERVAL = 2600

export function HeroHeadline({ initialIndex = 0 }: { initialIndex?: number }) {
  const [idx, setIdx]           = useState(initialIndex)
  const [isPaused, setIsPaused] = useState(false)
  const reduced                 = useReducedMotion()

  const next = useCallback(() => setIdx(p => (p + 1) % ROTATING_WORDS.length), [])

  useEffect(() => {
    if (isPaused) return
    const id = setInterval(next, INTERVAL)
    return () => clearInterval(id)
  }, [isPaused, next])

  const word  = ROTATING_WORDS[idx]
  const style = WORD_STYLES[word]
  const dur   = reduced ? 0 : 0.28
  const spring = { type: 'spring' as const, stiffness: 320, damping: 28 }

  return (
    <div className="select-none" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>

      {/* "Detect" — static with gradient */}
      <h1
        className="font-black leading-none tracking-tight
                   text-[2.5rem] xs:text-[3rem] sm:text-[3.75rem] md:text-[4.5rem] lg:text-[5rem]"
        style={{
          background: 'linear-gradient(150deg,#ffffff 0%,#cbd5e1 55%,#94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Detect
      </h1>

      {/* Rotating word row */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1 mt-1">
        {/* Animated word slot — height fixed for vertical-slide anim, width auto */}
        <div
          className="relative overflow-hidden
                     h-[2.5rem] xs:h-[3rem] sm:h-[3.75rem] md:h-[4.5rem] lg:h-[5rem]
                     flex items-center"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={word}
              initial={reduced ? false : { opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, y: -16, scale: 0.94 }}
              transition={reduced ? { duration: 0 } : spring}
              className="font-black tracking-tight leading-none whitespace-nowrap
                         text-[2.5rem] xs:text-[3rem] sm:text-[3.75rem] md:text-[4.5rem] lg:text-[5rem]"
              style={{ color: style.color, textShadow: `0 0 30px ${style.glow}` }}
            >
              {word}
            </motion.div>
          </AnimatePresence>
        </div>

        <span
          className="font-semibold tracking-tight text-slate-400 leading-none
                     text-xl xs:text-2xl sm:text-3xl md:text-4xl whitespace-nowrap pb-1"
        >
          with AI
        </span>
      </div>

      {/* Tab dots */}
      <div className="flex gap-1.5 mt-4">
        {ROTATING_WORDS.map((w, i) => {
          const active = i === idx
          const ws = WORD_STYLES[w]
          return (
            <button
              key={w}
              role="tab"
              aria-selected={active}
              aria-label={`Show ${w}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => { setIdx(i); setIsPaused(true) }}
              className="flex items-center justify-center
                         min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2BEE34]/50 rounded-full"
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: active ? '20px' : '6px',
                  height: '6px',
                  backgroundColor: active ? ws.color : 'rgba(255,255,255,0.15)',
                  boxShadow: active ? `0 0 12px ${ws.glow}` : 'none',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
