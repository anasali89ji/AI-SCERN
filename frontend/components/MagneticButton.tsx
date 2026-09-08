'use client'
import { useRef, useState, type ReactNode, type MouseEvent } from 'react'
import { motion } from 'framer-motion'

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  /** How strongly the button follows the cursor. 0.2–0.4 feels natural. */
  strength?: number
}

/**
 * Wraps any button/link so it subtly follows the cursor within its bounds,
 * then springs back to center on mouse leave. Disabled automatically for
 * touch/reduced-motion — this is a hover-only delight, not a functional cue.
 * Renders as an inline-block div so it works with <Link>, <button>, etc.
 */
export function MagneticButton({ children, className = '', strength = 0.3 }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) * strength
    const y = (e.clientY - rect.top - rect.height / 2) * strength
    setPos({ x, y })
  }

  const handleMouseLeave = () => setPos({ x: 0, y: 0 })

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 12, mass: 0.5 }}
      className={`magnetic-btn inline-block ${className}`}
    >
      {children}
    </motion.div>
  )
}
