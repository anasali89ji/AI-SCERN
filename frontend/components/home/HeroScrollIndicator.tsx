'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function HeroScrollIndicator() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 100) setHidden(true) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (hidden) return null
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 animate-bounce opacity-30 pointer-events-none">
      <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Explore</span>
      <ChevronDown className="w-4 h-4 text-text-muted" />
    </div>
  )
}
