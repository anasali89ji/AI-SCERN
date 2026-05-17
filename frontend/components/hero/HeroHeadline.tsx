'use client'

/**
 * components/hero/HeroHeadline.tsx
 *
 * Renders the hero headline:
 *   "Detect"          ← static, large, gradient
 *   "[Text] with AI"  ← animated rotating word + static suffix
 *
 * Animation behaviour:
 *  - Default:  AnimatePresence fade+slide (60fps via transform/opacity)
 *  - prefers-reduced-motion: instant swap, no motion
 *  - Pauses on hover (accessibility + usability)
 *  - Dot indicators double as manual controls
 *  - aria-live="polite" announces word changes to screen readers
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const ROTATING_WORDS = ['Text', 'Image', 'Audio', 'Video'] as const
const WORD_COLORS = ['text-amber', 'text-primary', 'text-cyan', 'text-secondary'] as const
const ROTATION_INTERVAL_MS = 2500

interface HeroHeadlineProps {
  /** Override the initial word index (0-3) */
  initialIndex?: number
}

export function HeroHeadline({ initialIndex = 0 }: HeroHeadlineProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isPaused,     setIsPaused]     = useState(false)
  const reducedMotion = useReducedMotion()

  const advance = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % ROTATING_WORDS.length)
  }, [])

  useEffect(() => {
    if (isPaused) return
    const id = setInterval(advance, ROTATION_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isPaused, advance])

  const word  = ROTATING_WORDS[currentIndex]
  const color = WORD_COLORS[currentIndex]

  /* ── Framer variants (disabled when reducedMotion) ── */
  const variants = {
    enter:  { opacity: 0, y: reducedMotion ? 0 : 18  },
    center: { opacity: 1, y: 0 },
    exit:   { opacity: 0, y: reducedMotion ? 0 : -18 },
  }
  const transition = {
    duration: reducedMotion ? 0 : 0.35,
    ease:     [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  }

  return (
    <div className="text-center select-none">

      {/* ── Static "Detect" ─────────────────────────────────────────── */}
      <motion.h1
        className="font-black leading-[0.92] tracking-tight"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.55, ease: 'easeOut' }}
      >
        {/* Mobile: compact */}
        <span
          className="block sm:hidden text-[2.6rem] xs:text-[3rem]"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #d8b4fe 50%, #8B5CF6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Detect
        </span>

        {/* Desktop: large */}
        <span
          className="hidden sm:block text-6xl md:text-7xl lg:text-8xl xl:text-[6rem]"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #d8b4fe 40%, #8B5CF6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Detect
        </span>
      </motion.h1>

      {/* ── Rotating word row ─────────────────────────────────────────── */}
      <motion.div
        className="mt-3 sm:mt-4 flex items-center justify-center gap-2 sm:gap-3"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.55, delay: 0.15, ease: 'easeOut' }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={()    => setIsPaused(true)}
        onBlur={()     => setIsPaused(false)}
      >
        {/* Fixed-height container prevents layout shift */}
        <div
          className="relative h-9 sm:h-11 md:h-14 overflow-hidden flex items-center"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Currently showing: ${word}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={currentIndex}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className={`
                absolute inset-0 flex items-center justify-center
                text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black
                ${color}
              `}
              style={{ willChange: reducedMotion ? 'auto' : 'transform, opacity' }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </div>

        <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-text-secondary whitespace-nowrap">
          with AI
        </span>
      </motion.div>

      {/* ── Dot indicators / manual controls ──────────────────────────── */}
      <motion.div
        className="mt-4 sm:mt-5 flex items-center justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.4, delay: 0.35 }}
        role="tablist"
        aria-label="Select content type"
      >
        {ROTATING_WORDS.map((w, i) => (
          <button
            key={w}
            role="tab"
            aria-selected={i === currentIndex}
            aria-label={`Detect ${w}`}
            onClick={() => { setCurrentIndex(i); setIsPaused(true) }}
            onBlur={() => setIsPaused(false)}
            className={`
              rounded-full transition-all duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
              ${i === currentIndex
                ? `w-5 sm:w-6 h-2 sm:h-2.5 ${WORD_COLORS[i].replace('text-', 'bg-')}`
                : 'w-2 sm:w-2.5 h-2 sm:h-2.5 bg-text-muted/30 hover:bg-text-muted/60'
              }
            `}
          />
        ))}
      </motion.div>

    </div>
  )
}
