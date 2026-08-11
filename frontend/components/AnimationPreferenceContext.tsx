/**
 * AnimationPreferenceContext — F.2 / Module A.4
 *
 * Read by StreamingMessage (chat), framer-motion animated components,
 * and any component that should skip transitions when the user enables
 * "Reduce animations" in Settings.
 *
 * Source of truth: user_settings.animations_off (DB-persisted).
 * Falls back to `prefers-reduced-motion` for unauthenticated users.
 */
'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface AnimationPref {
  reduceAnimations: boolean
  setReduceAnimations: (v: boolean) => void
}

const Ctx = createContext<AnimationPref>({
  reduceAnimations: false,
  setReduceAnimations: () => {},
})

export function AnimationPreferenceProvider({ children }: { children: ReactNode }) {
  const [reduceAnimations, setReduceAnimations] = useState(false)

  useEffect(() => {
    // 1. Respect OS-level prefers-reduced-motion immediately
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) setReduceAnimations(true)
    const listener = (e: MediaQueryListEvent) => { if (e.matches) setReduceAnimations(true) }
    mq.addEventListener('change', listener)

    // 2. Override with DB-persisted user preference (loaded by settings page)
    const cached = localStorage.getItem('aiscern_animations_off')
    if (cached === 'true')  setReduceAnimations(true)
    if (cached === 'false') setReduceAnimations(false)

    return () => mq.removeEventListener('change', listener)
  }, [])

  return (
    <Ctx.Provider value={{ reduceAnimations, setReduceAnimations }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAnimationPref = () => useContext(Ctx)
