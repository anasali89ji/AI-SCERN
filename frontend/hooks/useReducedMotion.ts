'use client'
import { useEffect, useState } from 'react'

/**
 * Returns true when the user has enabled "Reduce Motion" in their OS settings.
 * Use this to disable particle animations, auto-scroll, and heavy transitions
 * for users with vestibular disorders or motion sensitivity.
 *
 * Always initializes to `false` (matching the server-rendered value) and only
 * updates in useEffect, which runs after hydration completes. A lazy
 * useState initializer that reads window.matchMedia was tried here before —
 * it actually caused a React hydration mismatch (error #418) for anyone with
 * OS-level Reduce Motion on, because useState initializers run during React's
 * first CLIENT render too (pre-hydration), not only at true mount — so it
 * could disagree with the server's `false` on that very first render.
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
