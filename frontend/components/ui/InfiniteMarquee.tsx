'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface MarqueeProps {
  children: React.ReactNode[]
  speed?: number
  direction?: 'left' | 'right'
  gap?: number
  pauseOnHover?: boolean
  className?: string
}

export function InfiniteMarquee({
  children,
  speed = 40,
  direction = 'left',
  gap = 24,
  pauseOnHover = true,
  className = '',
}: MarqueeProps) {
  const [paused, setPaused] = useState(false)
  const count = children.length
  const totalWidth = count * (200 + gap)
  const duration = totalWidth / speed
  const xFrom = direction === 'left' ? '0%' : '-50%'
  const xTo   = direction === 'left' ? '-50%' : '0%'

  return (
    <div
      className={`overflow-hidden ${className}`}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
    >
      <motion.div
        className="flex"
        style={{ gap }}
        animate={{ x: paused ? undefined : [xFrom, xTo] }}
        transition={{
          duration,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        {[...children, ...children].map((child, i) => (
          <div key={i} className="flex-shrink-0">
            {child}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
