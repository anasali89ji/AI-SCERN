'use client'

import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/** Horizontal SVG line draw-in (HowItWorksSection's connector). */
export function LineDrawSVG({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  return (
    <svg className={className} aria-hidden="true">
      <motion.line
        x1="12.5%" y1="0" x2="87.5%" y2="0"
        stroke="rgba(37,99,235,0.3)" strokeWidth="2" strokeDasharray="8 4"
        initial={reduced ? undefined : { pathLength: 0 }}
        whileInView={reduced ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
    </svg>
  )
}

/** Vertical bar scaleY draw-in (TechnologySection's connector). */
export function LineDrawVertical({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduced ? undefined : { scaleY: 0, originY: 0 }}
      whileInView={reduced ? undefined : { scaleY: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
    />
  )
}
