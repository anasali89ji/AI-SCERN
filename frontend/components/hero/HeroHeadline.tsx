'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } 
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
      <div>
        <h1
          className="font-black leading-none tracking-tight
                     text-[3rem] xs:text-[3.5rem] sm:text-[4.5rem] md:text-[5.5rem] lg:text-[6.5rem]"
          style={{
            background: 'linear-gradient(150deg,#ffffff 0%,#cbd5e1 55%,#94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Detect
        </h1>
      </div>

      {/* Rotating word row */}
      <div>
        {/* Animated word slot — sized for longest word at each breakpoint */}
        <div
          className="relative overflow-hidden
                     w-20  h-9
                     xs:w-24 xs:h-10
                     sm:w-32 sm:h-12
                     md:w-40 md:h-[3.5rem]
                     lg:w-52 lg:h-16"
          aria-live="polite"
          aria-atomic="true"
        >
          
            <div>
              {word}
            </div>
          
        </div>

        <span
          className="font-semibold tracking-tight text-slate-400
                     text-2xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl whitespace-nowrap"
        >
          with AI
        </span>
      </div>

      {/* Tab dots */}
      <div>
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
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-full"
            >
              <div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
