'use client'
import { useRef, useCallback } from 'react'
import { useMousePosition } from '@/hooks/useMousePosition'

interface SpotlightCardProps {
  children: React.ReactNode
  className?: string
  spotlightColor?: string
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(37,99,235,0.06)',
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((x: number, y: number) => {
    if (!ref.current) return
    ref.current.style.setProperty('--mouse-x', `${x}px`)
    ref.current.style.setProperty('--mouse-y', `${y}px`)
  }, [])

  useMousePosition(ref, onMove)

  return (
    <div
      ref={ref}
      className={`spotlight-card ${className}`}
      style={{ '--spotlight-color': spotlightColor } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
