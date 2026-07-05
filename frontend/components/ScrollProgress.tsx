'use client'
import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * Thin progress bar fixed under the nav, tracking page scroll position.
 * Uses framer-motion's scroll-linked value + spring smoothing so it
 * doesn't feel jittery on fast scrolls.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left pointer-events-none"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #2BEE34, #06b6d4)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    />
  )
}
