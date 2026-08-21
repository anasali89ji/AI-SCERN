'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface FAQItem {
  q: string
  a: string
}

export function FAQAccordion({ faqs }: { faqs: FAQItem[] }) {
  const shouldReduceMotion = useReducedMotion()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div>
      {faqs.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={item.q} className="rounded-2xl bg-surface border border-border mb-4 overflow-hidden">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 p-6 text-left"
            >
              <span className="text-lg font-medium text-text-primary">{item.q}</span>
              <ChevronDown
                className={`w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  animate={shouldReduceMotion ? undefined : { height: 'auto', opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="text-base text-text-secondary leading-relaxed px-6 pb-6 pt-0">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
