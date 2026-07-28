'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const TESTIMONIALS = [
  {
    name: 'Dr. Ayesha Khan',
    role: 'Dean of Academic Affairs',
    org: 'DHA Suffa University',
    quote: 'Aiscern has become essential for our examination office. We now verify every thesis submission for AI-generated content before it reaches the review board.',
    initials: 'AK',
    accent: '#7c3aed',
  },
  {
    name: 'Bilal Ahmed',
    role: 'Editor-in-Chief',
    org: 'Daily Times Pakistan',
    quote: 'In an election cycle flooded with synthetic media, Aiscern gives our fact-checking team the speed and confidence we need to publish responsibly.',
    initials: 'BA',
    accent: '#2563eb',
  },
  {
    name: 'Sana Tariq',
    role: 'Head of HR',
    org: 'Systems Limited',
    quote: 'We screened over 400 applications last quarter. Aiscern flagged 23 CVs with AI-generated cover letters we would have missed. The explainable reports make our decisions defensible.',
    initials: 'ST',
    accent: '#10b981',
  },
]

export default function TestimonialsSection() {
  const shouldReduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const go = (dir: 1 | -1) => {
    setIndex((prev) => (prev + dir + TESTIMONIALS.length) % TESTIMONIALS.length)
  }

  return (
    <section aria-label="Testimonials" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="text-center mb-12 md:mb-16">
          <span className="text-sm font-medium uppercase tracking-wider text-text-muted">What professionals say</span>
        </div>

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
            <TestimonialCard t={TESTIMONIALS[index]} />
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
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="testimonial-card rounded-[24px] p-6 snap-center flex-shrink-0 w-[85vw]">
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({ t }: { t: (typeof TESTIMONIALS)[number] }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-4" aria-label="5 out of 5 stars">
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
