'use client'

import { motion } from 'framer-motion'
import { Upload, Cpu, Eye, ArrowRight } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const STEPS = [
  { icon: Upload, title: 'Upload', description: 'Drop in any text, image, audio, or video file — no format conversion needed.' },
  { icon: Cpu, title: 'Analyze', description: 'Multiple AI detection engines run in parallel, cross-checking for synthetic artifacts across every modality.' },
  { icon: Eye, title: 'Review', description: 'Get a clear authenticity verdict with forensic evidence, confidence scores, and visual breakdowns.' },
  { icon: ArrowRight, title: 'Act', description: 'Export audit-ready trust verification reports, share results, or integrate via API into your workflow.' },
]

export default function HowItWorksSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="how-it-works" aria-label="How trust verification works" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <SectionHeader headline="From suspicion to certainty in under 30 seconds." />

        <div className="relative">
          {/* Desktop connector line */}
          <svg className="absolute top-8 left-0 right-0 h-1 hidden lg:block" aria-hidden="true">
            <motion.line
              x1="12.5%" y1="0" x2="87.5%" y2="0"
              stroke="rgba(37,99,235,0.3)"
              strokeWidth="2"
              strokeDasharray="8 4"
              initial={shouldReduceMotion ? undefined : { pathLength: 0 }}
              whileInView={shouldReduceMotion ? undefined : { pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </svg>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-6 relative lg:border-l-0 border-l-2 border-border/40 lg:pl-0 pl-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.title}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="relative rounded-[24px] bg-surface border border-border p-6 md:p-8 -ml-8 lg:ml-0"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">
                    <span className="text-text-muted mr-2">{i + 1}.</span>{step.title}
                  </h3>
                  <p className="text-base text-text-secondary leading-relaxed">{step.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
