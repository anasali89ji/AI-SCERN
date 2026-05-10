'use client'
import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false)
  const [visible, setVisible] = useState(false)
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const springX = useSpring(cursorX, { damping: 25, stiffness: 300 })
  const springY = useSpring(cursorY, { damping: 25, stiffness: 300 })

  useEffect(() => {
    // Only on desktop
    if (window.matchMedia('(hover: none)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
      if (!visible) setVisible(true)
    }

    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('[role="button"]')
      ) {
        setIsHovering(true)
      } else {
        setIsHovering(false)
      }
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', over)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
    }
  }, [cursorX, cursorY, visible])

  if (!visible) return null

  return (
    <>
      {/* Outer ring */}
      <motion.div
        className="fixed pointer-events-none z-[9999] hidden lg:block"
        style={{
          x: springX,
          y: springY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      >
        <motion.div
          className="rounded-full border border-purple-400/40"
          animate={{
            width: isHovering ? 40 : 24,
            height: isHovering ? 40 : 24,
            opacity: isHovering ? 0.6 : 0.3,
          }}
          transition={{ duration: 0.2 }}
          style={{ mixBlendMode: 'difference' }}
        />
      </motion.div>
      {/* Inner dot */}
      <motion.div
        className="fixed pointer-events-none z-[9999] hidden lg:block"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      >
        <motion.div
          className="rounded-full bg-purple-400"
          animate={{
            width: isHovering ? 6 : 6,
            height: isHovering ? 6 : 6,
            opacity: isHovering ? 0.9 : 0.7,
          }}
          transition={{ duration: 0.1 }}
        />
      </motion.div>
    </>
  )
}
