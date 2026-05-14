'use client'
import { useEffect } from 'react'

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dynamically import Lenis to avoid SSR issues
    let lenis: any = null

    const init = async () => {
      try {
        const { default: Lenis } = await import('lenis')
        lenis = new Lenis({
          lerp: 0.1,
          duration: 1.2,
          smoothWheel: true,
          syncTouch: true,
        })

        function raf(time: number) {
          lenis.raf(time)
          requestAnimationFrame(raf)
        }
        requestAnimationFrame(raf)
      } catch {
        // Lenis failed to load, fall back to native scroll
      }
    }

    // Only init on desktop (mobile has native smooth scroll)
    if (window.matchMedia('(hover: hover)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      init()
    }

    return () => {
      if (lenis) lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
