'use client'
import { useEffect, useState } from 'react'

/**
 * Returns true when the user has enabled "Reduce Motion" in their OS settings.
 * Use this to disable particle animations, auto-scroll, and heavy transitions
 * for users with vestibular disorders or motion sensitivity.
 *
 * NOTE: We initialize to `false` and update inside `useEffect` to avoid React 19
 * hydration mismatch #418. A lazy `useState(() => window.matchMedia(...))`
 * initializer causes the mismatch for users with OS-level Reduce Motion ON,
 * because the initializer runs during the first client render pre-hydration.
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
