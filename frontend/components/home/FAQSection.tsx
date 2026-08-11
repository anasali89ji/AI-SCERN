'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const FAQS = [
  {
    q: 'How accurate is Aiscern\'s AI content detection?',
    a: 'Aiscern uses an ensemble of multiple detection models combined with a RAG-augmented forensic pipeline. Published benchmarks show ~95% accuracy on text, ~91% on images, ~88% on audio, and ~85% on video. Accuracy varies by content type and AI model generation. Our trust verification platform cross-references multiple signals to minimize false positives.',
  },
  {
    q: 'Can AI content detection ever be 100% certain?',
    a: 'No. AI content detection and deepfake detection are probabilistic, not deterministic. Aiscern provides confidence scores and forensic reasoning, not binary guarantees. We recommend human review for high-stakes decisions — our trust verification reports are designed to support, not replace, professional judgment.',
  },
  {
    q: 'How is my data protected during trust verification?',
    a: 'All uploads are encrypted in transit and at rest. Files are stored in isolated Cloudflare R2 buckets with automatic deletion policies. We never use customer content to train our AI detection models. Your data belongs to you — period.',
  },
  {
    q: 'Do you support enterprise API access for automated trust verification?',
    a: 'Yes. Pro and Enterprise plans include REST API access with per-key rate limiting, webhook notifications, and batch processing for high-volume AI content detection workflows. Documentation is available at aiscern.com/docs/api.',
  },
  {
    q: 'Can I detect AI-generated images, audio, and video — not just text?',
    a: 'Yes. Aiscern is a multi-modal trust verification platform supporting all four content types from a single dashboard. Upload directly or use our API to programmatically submit files for deepfake detection and synthetic media analysis.',
  },
]

export default function FAQSection() {
  const shouldReduceMotion = useReducedMotion()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" aria-label="Frequently asked questions about AI content detection" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader headline="Frequently asked questions about trust verification." />

        <div>
          {FAQS.map((item, i) => {
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
      </div>
    </section>
  )
}
