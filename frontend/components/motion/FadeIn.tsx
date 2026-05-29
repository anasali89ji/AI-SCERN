"use client"
import { motion, type Variants } from "framer-motion"
import { type ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: "up" | "down" | "left" | "right" | "none"
  className?: string
  once?: boolean
}

const directionOffset = {
  up:    { y: 16 },
  down:  { y: -16 },
  left:  { x: 16 },
  right: { x: -16 },
  none:  {},
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  direction = "up",
  className,
  once = true,
}: FadeInProps) {
  const variants: Variants = {
    hidden:  { opacity: 0, ...directionOffset[direction] },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <motion.div
      // Start visible on server, animate on client
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}
