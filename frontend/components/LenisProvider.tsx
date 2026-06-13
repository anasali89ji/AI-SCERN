'use client'
import { useEffect } from 'react'

/**
 * LenisProvider — smooth scroll via dynamic import.
 * 'lenis' is an optional peer dep; if missing the package gracefully
 * falls back to native scroll (catch block). TypeScript error suppressed
 * via dynamic import with explicit any cast so the build never fails on
 * a missing lenis type declaration.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null
    let rafId: number

    const init = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = await import('lenis' as any)
        const Lenis = mod?.default ?? mod
        lenis = new Lenis({
          lerp: 0.1,
          duration: 1.2,
          smoothWheel: true,
          syncTouch: true,
        })
        const raf = (time: number) => {
          lenis?.raf(time)
          rafId = requestAnimationFrame(raf)
        }
        rafId = requestAnimationFrame(raf)
      } catch {
        // lenis package not installed — native scroll used
      }
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      init()
    }

    return () => {
      cancelAnimationFrame(rafId)
      lenis?.destroy()
    }
  }, [])

  return <>{children}</>
}
