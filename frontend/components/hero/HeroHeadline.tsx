"use client"

import { motion } from "framer-motion"
import { useReducedMotion } from "@/hooks/useReducedMotion"

export function HeroHeadline() {
  const reduced = useReducedMotion()

  return (
    <div className="max-w-[48ch]">
      <motion.h1
        className="font-heading font-bold text-silver-900 tracking-tight
          text-[2rem] leading-[1.12]
          sm:text-[2.75rem] sm:leading-[1.08]
          lg:text-[3.5rem] lg:leading-[1.05]
          xl:text-[4rem]"
        initial={reduced ? {} : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Detect AI-generated content.
      </motion.h1>
      <motion.p
        className="font-heading font-semibold text-silver-700 tracking-tight mt-1
          text-[1.125rem] leading-[1.25]
          sm:text-[1.375rem] sm:leading-[1.2]
          lg:text-[1.75rem]
          xl:text-[2rem]"
        initial={reduced ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        In seconds — with evidence, not guesses.
      </motion.p>
    </div>
  )
}
