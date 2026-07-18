'use client'

import { useRef } from 'react'
import { motion, useScroll } from 'framer-motion'
import { Upload, Waves, Scale, FileBarChart } from 'lucide-react'

const STEPS = [
  { n: '01', title: 'Ingestion',          desc: 'Upload a file or paste text — any format, any size.',                      icon: Upload      },
  { n: '02', title: 'Signal Extraction',  desc: 'Waveform, pixel, and linguistic patterns analyzed in parallel.',           icon: Waves       },
  { n: '03', title: 'Ensemble Judgement', desc: 'Multiple independent models vote — no single model decides alone.',        icon: Scale       },
  { n: '04', title: 'Forensic Report',    desc: 'A verdict with a full signal-by-signal breakdown, in under 3 seconds.',    icon: FileBarChart },
]

export function MethodologySection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] })

  return (
    <section className="py-14 sm:py-28 px-4 sm:px-6 border-t border-white/[0.06]" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">How It Works</p>
          <h2 className="text-headline text-silver-900">From upload to verdict</h2>
        </div>

        <div className="relative">
          {/* ── True mobile (<640px): vertical timeline ──
              Stacking the same bordered cards straight down loses the
              "process" feeling entirely (no connector renders below lg).
              A left-aligned timeline with a scroll-filled line reads as a
              sequence, not four unrelated boxes. */}
          <div className="sm:hidden relative pl-[52px]">
            <div className="absolute left-[17px] top-1 bottom-1 w-px bg-white/10" aria-hidden="true">
              <motion.div className="w-full h-full bg-accent origin-top" style={{ scaleY: scrollYProgress }} />
            </div>
            <div className="flex flex-col gap-8">
              {STEPS.map(step => (
                <div key={step.n} className="relative">
                  <div
                    className="absolute -left-[52px] top-0 w-9 h-9 rounded-full bg-surface border border-white/10
                               flex items-center justify-center z-10"
                    aria-hidden="true"
                  >
                    <step.icon className="w-4 h-4 text-accent" strokeWidth={1.8} />
                  </div>
                  <span className="block text-xs font-bold text-accent/60 tabular-nums mb-1">{step.n}</span>
                  <h3 className="text-base font-semibold text-silver-900 mb-1.5">{step.title}</h3>
                  <p className="text-sm text-silver-600 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Connector line — sm and up, animates with scroll progress */}
          <div className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-px bg-white/10" aria-hidden="true">
            <motion.div
              className="h-full bg-accent origin-left"
              style={{ scaleX: scrollYProgress }}
            />
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 relative">
            {STEPS.map(step => (
              <div key={step.n} className="relative rounded-xl border border-white/[0.06] bg-surface p-6">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl font-bold text-accent/30 tabular-nums">{step.n}</span>
                  <step.icon className="w-5 h-5 text-silver-600/50" strokeWidth={1.6} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-silver-900 mb-2">{step.title}</h3>
                <p className="text-sm text-silver-600 leading-relaxed">{step.desc}</p>
                {/* Dot marker on the connector line */}
                <span
                  className="hidden lg:block absolute -top-[27px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
