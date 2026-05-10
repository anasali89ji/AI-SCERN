'use client'
import { useEffect, useRef } from 'react'

export function useMousePosition(
  ref: React.RefObject<HTMLElement | null>,
  onMove: (x: number, y: number) => void
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      onMove(e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('mousemove', handler)
    return () => el.removeEventListener('mousemove', handler)
  }, [ref, onMove])
}
