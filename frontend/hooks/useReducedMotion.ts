'use client'
import { useEffect, useState } from 'react'

/**
 * Returns true when the user has enabled "Reduce Motion" in their OS settings.
 * Use this to disable particle animations, auto-scroll, and heavy transitions
 * for users with vestibular disorders or motion sensitivity.
 *
 * Uses a lazy initializer so the correct value is available on first render,
 * avoiding a React 19 hydration mismatch when the user has reduced motion ON.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    // Safe SSR check — window doesn't exist on the server
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
