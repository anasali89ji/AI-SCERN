'use client'

import { motion, type Variants } from 'framer-motion'

/**
 * Thin client-side wrapper around framer-motion's scroll/mount reveal
 * animations. Content passed as `children` can be server-rendered JSX —
 * only this wrapper itself ships as client JS, not the content inside it.
 *
 * trigger="inView"  -> whileInView (viewport, once) — used for below-the-fold sections
 * trigger="mount"   -> animate on mount — used for above-the-fold hero content
 */
export function Reveal({
  children,
  className = '',
  trigger = 'inView',
  y = 24,
  delay = 0,
  duration = 0.6,
  amount = 0.2,
  as: Component = 'div',
}: {
  children: React.ReactNode
  className?: string
  trigger?: 'inView' | 'mount'
  y?: number
  delay?: number
  duration?: number
  amount?: number
  as?: 'div' | 'span'
}) {
  const initial = { opacity: 0, y }
  const animateProp = trigger === 'inView'
    ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount } }
    : { animate: { opacity: 1, y: 0 } }

  if (Component === 'span') {
    return (
      <motion.span className={className} initial={initial} transition={{ delay, duration }} {...animateProp}>
        {children}
      </motion.span>
    )
  }
  return (
    <motion.div className={className} initial={initial} transition={{ delay, duration }} {...animateProp}>
      {children}
    </motion.div>
  )
}
