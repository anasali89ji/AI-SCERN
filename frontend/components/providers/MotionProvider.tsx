'use client'
/**
 * MotionProvider — wraps the app with LazyMotion (async animation bundle)
 * and MotionConfig for consistent animation settings.
 *
 * LazyMotion with domAnimation loads the full animation feature set
 * asynchronously, keeping the initial bundle small.
 */
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { type ReactNode } from 'react'

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
