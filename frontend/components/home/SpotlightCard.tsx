'use client'

import { useRef, useCallback } from 'react'

export function SpotlightCard({ children, className = '', color = 'rgba(37,99,235,0.12)' }: {
  children: React.ReactNode; className?: string; color?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    ref.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }, [])
  return (
    <div ref={ref} onMouseMove={onMouseMove}
      className={`spotlight-card ${className}`}
      style={{ '--spotlight-color': color } as React.CSSProperties}>
      {children}
    </div>
  )
}
