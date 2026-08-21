'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Testimonial {
  name: string
  role: string
  org: string
  quote: string
  initials: string
  accent: string
}

export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const shouldReduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const go = (dir: 1 | -1) => {
    setIndex((prev) => (prev + dir + testimonials.length) % testimonials.length)
  }

  return (
    <>
      {/* Desktop: single card with arrow navigation */}
      <div className="hidden md:flex items-center justify-center gap-6 max-w-3xl mx-auto">
        <button
          onClick={() => go(-1)}
          aria-label="Previous testimonial"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>

        <motion.div
          key={index}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="testimonial-card rounded-[24px] p-8 md:p-10 flex-1"
        >
          <TestimonialCard t={testimonials[index]} />
        </motion.div>

        <button
          onClick={() => go(1)}
          aria-label="Next testimonial"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile: horizontal snap scroll */}
      <div ref={scrollRef} className="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6">
        {testimonials.map((t) => (
          <div key={t.name} className="testimonial-card rounded-[24px] p-6 snap-center flex-shrink-0 w-[85vw]">
            <TestimonialCard t={t} />
          </div>
        ))}
      </div>
    </>
  )
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-4" role="img" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-amber text-amber" aria-hidden="true" />
        ))}
      </div>
      <p className="text-xl md:text-2xl font-medium text-text-primary leading-relaxed mb-6">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: t.accent }}
        >
          {t.initials}
        </div>
        <div>
          <div className="text-sm font-semibold text-text-primary">{t.name}</div>
          <div className="text-xs text-text-muted">{t.role}</div>
        </div>
        <span className="ml-auto rounded-lg bg-surface-active px-3 py-1 text-xs font-medium text-text-muted">
          {t.org}
        </span>
      </div>
    </div>
  )
}
