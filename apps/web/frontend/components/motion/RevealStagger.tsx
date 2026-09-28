'use client'

import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

/** Container half of the stagger-reveal pattern. Children stay server-rendered. */
export function RevealStagger({
  children, className = '', margin = '-100px',
}: { children: React.ReactNode; className?: string; margin?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div className={className}
      initial={reduced ? undefined : 'hidden'}
      whileInView={reduced ? undefined : 'visible'}
      viewport={{ once: true, margin }}
      variants={containerVariants}>
      {children}
    </motion.div>
  )
}

/** Item half — must be a direct/descendant child of RevealStagger to inherit variants. */
export function RevealStaggerItem({
  children, className = '', as = 'div',
}: { children: React.ReactNode; className?: string; as?: 'div' | 'article' | 'li' }) {
  const Component = motion[as]
  return (
    <Component className={className} variants={itemVariants}>
      {children}
    </Component>
  )
}
