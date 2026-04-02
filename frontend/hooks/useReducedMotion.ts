'use client'
import { useEffect, useState } from 'react'

/**
 * Returns true when the user has enabled "Reduce Motion" in their OS settings.
 * Use this to disable particle animations, auto-scroll, and heavy transitions
 * for users with vestibular disorders or motion sensitivity.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
