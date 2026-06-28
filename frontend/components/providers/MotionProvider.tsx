'use client'
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'
import { type ReactNode } from 'react'

/**
 * LazyMotion wraps the app with domAnimation feature set only (~18KB vs ~50KB for domMax).
 * Covers whileInView, whileHover, variants, AnimatePresence — all we need.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
