'use client'
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'
import { type ReactNode } from 'react'
import { useAnimationPref } from '@/components/AnimationPreferenceContext'

/**
 * LazyMotion wraps the app with domAnimation feature set only (~18KB vs ~50KB for domMax).
 * Covers whileInView, whileHover, variants, AnimatePresence — all we need.
 *
 * reducedMotion is "always" when the user has enabled "Reduce animations" in
 * Settings (or their OS prefers-reduced-motion, picked up by
 * AnimationPreferenceProvider), otherwise "user" defers to the OS setting.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const { reduceAnimations } = useAnimationPref()
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion={reduceAnimations ? 'always' : 'user'}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
