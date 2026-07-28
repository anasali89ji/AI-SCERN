'use client'

import { motion } from 'framer-motion'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const LAYERS = [
  { title: 'Input', desc: 'Accepts text, images, audio, and video in any common format.', border: 'border-l-primary' },
  { title: 'Preprocessing', desc: 'Normalizes, resizes, and extracts raw signals for analysis.', border: 'border-l-secondary' },
  { title: 'Multi-model Analysis', desc: 'Ensemble of specialized models inspects content in parallel.', border: 'border-l-cyan' },
  { title: 'Forensic Detection', desc: 'Pixel-level, spectral, and linguistic forensics hunt for synthetic artifacts.', border: 'border-l-primary' },
  { title: 'Consistency Engine', desc: 'Cross-references signals to resolve conflicts and reduce false positives.', border: 'border-l-secondary' },
  { title: 'Risk Scoring', desc: 'Aggregates all signals into an explainable confidence score.', border: 'border-l-emerald' },
  { title: 'Report Generation', desc: 'Produces human-readable reports with evidence and reasoning.', border: 'border-l-emerald' },
]

export default function TechnologySection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="technology" aria-label="AI detection technology" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader headline="Powered by multi-layer AI forensic analysis." />

        <div className="relative">
          {/* Vertical connector */}
          <div className="absolute left-6 md:left-8 top-2 bottom-2 w-px overflow-hidden" aria-hidden="true">
            <motion.div
              className="h-full w-full trust-pulse"
              style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.7) 0%, rgba(16,185,129,0.5) 100%)' }}
              initial={shouldReduceMotion ? undefined : { scaleY: 0, originY: 0 }}
              whileInView={shouldReduceMotion ? undefined : { scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </div>

          <div className="space-y-4">
            {LAYERS.map((layer, i) => (
              <motion.div
                key={layer.title}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={`relative ml-2 md:ml-4 rounded-2xl bg-surface border border-border ${layer.border} border-l-4 p-6`}
              >
                <h3 className="text-lg font-semibold text-text-primary mb-1">{layer.title}</h3>
                <p className="text-sm md:text-base text-text-secondary leading-relaxed">{layer.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
