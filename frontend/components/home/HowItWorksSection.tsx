'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import Link from 'next/link'
import { Upload, Waves, Scale, FileBarChart, Check } from 'lucide-react'

const STEPS = [
  {
    num: '01',
    icon: Upload,
    title: 'Ingestion',
    summary: 'Upload or paste any content — text, image, audio, video, or PDF.',
    details: [
      'Drag-and-drop or paste · text, image, audio, video, PDF',
      'URL-based scanning for web content verification',
      'Batch upload up to 20 files simultaneously',
    ],
  },
  {
    num: '02',
    icon: Waves,
    title: 'Signal Extraction',
    summary: '20+ independent forensic signals analyze every layer of the content.',
    details: [
      '20+ forensic signals · sensor physics, compression, linguistic patterns',
      'Per-modality specialized analyzers for each media type',
      'Noise-floor, spectral, and structural artifact detection',
    ],
  },
  {
    num: '03',
    icon: Scale,
    title: 'Ensemble Judgement',
    summary: 'Independent models vote. Uncertainty is surfaced, never hidden.',
    details: [
      'Independent models vote · uncertainty is surfaced, never hidden',
      'Layer-weighted scoring with confidence intervals',
      'No single point of failure — consensus-based verdict',
    ],
  },
  {
    num: '04',
    icon: FileBarChart,
    title: 'Forensic Report',
    summary: 'Verdict + confidence + evidence. Exportable report in <3 seconds.',
    details: [
      'Verdict + confidence + evidence · exportable report in <3s',
      'Sentence-level heatmaps for text analysis',
      'Signal-level transparency with full audit trail',
    ],
    cta: { label: 'Run your first scan', href: '/detect/text' },
  },
]

export function HowItWorksSection() {
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  })

  const progressY = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  const progressX = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section id="how-it-works" className="section" ref={containerRef}>
      <div className="container-page">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">
            How it works
          </p>
          <h2 className="font-heading font-bold text-headline text-silver-900 tracking-tight mb-3 sm:mb-4">
            Four steps to certainty
          </h2>
          <p className="text-lead text-silver-600 max-w-xl mx-auto">
            Aiscern runs every upload through a rigorous forensic pipeline — no black boxes, no guesswork.
          </p>
        </div>

        {/* ── Mobile + Tablet (<1024px): vertical rail timeline ── */}
        <div className="lg:hidden relative pl-[52px] sm:pl-[52px]">
          {/* Rail */}
          <div className="absolute left-[17px] top-0 bottom-0 w-px bg-white/10" />
          {/* Progress fill */}
          <motion.div
            className="absolute left-[17px] top-0 w-px bg-accent origin-top"
            style={{ scaleY: reduced ? 1 : progressY, height: '100%' }}
          />

          <ol role="list" className="space-y-8 sm:space-y-10">
            {STEPS.map((step) => {
              const Icon = step.icon
              return (
                <li key={step.num} aria-label={`Step ${step.num}: ${step.title}`} className="relative">
                  {/* Node on rail */}
                  <div className="absolute -left-[52px] top-0 w-9 h-9 rounded-full bg-surface border border-white/20 flex items-center justify-center z-10">
                    <span className="text-accent/60 text-xs font-bold tabular-nums">{step.num}</span>
                  </div>

                  <div className="bg-surface border border-white/[0.06] rounded-xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
                        <Icon className="w-4 h-4 text-accent" strokeWidth={2} aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold text-silver-900">{step.title}</h3>
                    </div>
                    <p className="text-sm text-silver-600 leading-relaxed mb-3">{step.summary}</p>
                    <ul className="space-y-1.5">
                      {step.details.map((d, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-silver-600">
                          <Check className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                    {step.cta && (
                      <div className="mt-4 pt-3 border-t border-white/[0.06]">
                        <Link
                          href={step.cta.href}
                          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:gap-2 transition-all duration-200"
                        >
                          {step.cta.label} <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* ── Desktop (≥1024px): horizontal 4-step layout ── */}
        <div className="hidden lg:block relative">
          {/* Connector band */}
          <div className="relative">
            {/* Horizontal line */}
            <div className="absolute top-[52px] left-[12%] right-[12%] h-px bg-white/10" />
            {/* Progress fill */}
            <motion.div
              className="absolute top-[52px] left-[12%] h-px bg-accent origin-left"
              style={{ scaleX: reduced ? 1 : progressX, width: '76%' }}
            />

            <ol role="list" className="grid grid-cols-4 gap-4 pt-10">
              {STEPS.map((step) => {
                const Icon = step.icon
                return (
                  <li key={step.num} aria-label={`Step ${step.num}: ${step.title}`} className="relative">
                    {/* Dot marker */}
                    <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-surface z-10" />

                    <div className="bg-surface border border-white/[0.06] rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
                          <Icon className="w-4 h-4 text-accent" strokeWidth={2} aria-hidden="true" />
                        </div>
                        <span className="text-accent/60 text-sm font-bold tabular-nums">{step.num}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-silver-900 mb-2">{step.title}</h3>
                      <p className="text-sm text-silver-600 leading-relaxed mb-3">{step.summary}</p>
                      <ul className="space-y-1.5">
                        {step.details.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-silver-600">
                            <Check className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                      {step.cta && (
                        <div className="mt-4 pt-3 border-t border-white/[0.06]">
                          <Link
                            href={step.cta.href}
                            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:gap-2 transition-all duration-200"
                          >
                            {step.cta.label} <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
