'use client'
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
