'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false)
  const [visible, setVisible]       = useState(false)
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const springX = useSpring(cursorX, { damping: 25, stiffness: 300 })
  const springY = useSpring(cursorY, { damping: 25, stiffness: 300 })
  const visibleRef = useRef(false)

  useEffect(() => {
    // Desktop pointer only + respect reduced-motion
    if (window.matchMedia('(hover: none)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
      if (!visibleRef.current) { visibleRef.current = true; setVisible(true) }
    }

    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      const interactive =
        t.tagName === 'A' ||
        t.tagName === 'BUTTON' ||
        t.closest('a') ||
        t.closest('button') ||
        t.closest('[role="button"]') ||
        t.closest('[tabindex]')
      setIsHovering(!!interactive)
    }

    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('mouseover', over, { passive: true })
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
    }
  }, [cursorX, cursorY])

  if (!visible) return null

  return (
    <>
      {/* Outer ring — uses CSS variable z-index */}
      <motion.div
        className="fixed pointer-events-none hidden lg:block"
        style={{ x: springX, y: springY, translateX: '-50%', translateY: '-50%', zIndex: 'var(--z-cursor)' }}
      >
        <motion.div
          className="rounded-full border border-primary/40"
          animate={{ width: isHovering ? 40 : 24, height: isHovering ? 40 : 24, opacity: isHovering ? 0.7 : 0.35 }}
          transition={{ duration: 0.18 }}
          style={{ mixBlendMode: 'normal' }}
        />
      </motion.div>

      {/* Inner dot */}
      <motion.div
        className="fixed pointer-events-none hidden lg:block"
        style={{ x: cursorX, y: cursorY, translateX: '-50%', translateY: '-50%', zIndex: 'var(--z-cursor)' }}
      >
        <motion.div
          className="rounded-full bg-primary"
          animate={{ width: 6, height: 6, opacity: isHovering ? 1 : 0.8 }}
          transition={{ duration: 0.1 }}
        />
      </motion.div>
    </>
  )
}
