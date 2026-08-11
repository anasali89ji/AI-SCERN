'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Image as ImageIcon, Music, Video, Download, AlertTriangle } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type Modality = 'text' | 'image' | 'audio' | 'video'
type DemoState = 'idle' | 'analyzing' | 'complete'

const TABS: { id: Modality; label: string; icon: typeof FileText }[] = [
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'video', label: 'Video', icon: Video },
]

const SAMPLE_TEXT = `The rapid advancement of artificial intelligence has fundamentally transformed how organizations approach content verification. As generative models become increasingly sophisticated, the ability to distinguish authentic human-created content from synthetic material has emerged as a critical capability for institutions across education, media, and legal sectors.`

const EVIDENCE = [
  'Sentence-level perplexity is unusually uniform across the sample',
  'Burstiness score falls well below typical human-authored ranges',
  'Vocabulary distribution matches known GPT-family output patterns',
]

const RING_RADIUS = 45
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function InteractiveDemoSection() {
  const shouldReduceMotion = useReducedMotion()
  const [tab, setTab] = useState<Modality>('text')
  const [demoState, setDemoState] = useState<DemoState>('idle')
  const confidence = 87

  const runAnalysis = () => {
    if (demoState === 'analyzing') return
    setDemoState('analyzing')
    const delay = shouldReduceMotion ? 0 : 2000
    setTimeout(() => setDemoState('complete'), delay)
  }

  const reset = () => setDemoState('idle')

  const offset = demoState === 'complete'
    ? CIRCUMFERENCE * (1 - confidence / 100)
    : CIRCUMFERENCE

  return (
    <section id="demo" aria-label="Interactive AI content detection demo" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <SectionHeader headline="See trust verification in action." subheadline="A guided walkthrough of our AI content detection — try a real scan anytime from the tools above." />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
          {/* Left: Upload interface */}
          <div className="rounded-[24px] bg-surface border border-border p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6" role="tablist" aria-label="Select content type for detection">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setTab(t.id); reset() }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-muted border border-transparent hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {tab === 'text' ? (
              <div className="rounded-[24px] border border-dashed border-border bg-background/40 p-6 min-h-[280px] flex flex-col">
                <p className="text-sm text-text-secondary leading-relaxed flex-1">{SAMPLE_TEXT}</p>
                <button
                  onClick={runAnalysis}
                  disabled={demoState === 'analyzing'}
                  className="btn-primary mt-6 self-start px-6 py-3 text-sm font-bold flex items-center justify-center disabled:opacity-60"
                >
                  {demoState === 'analyzing' ? 'Analyzing…' : demoState === 'complete' ? 'Run Again' : 'Run AI Detection'}
                </button>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border bg-background/40 p-6 min-h-[280px] flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-text-muted max-w-xs">
                  This walkthrough uses a sample text file. Try {tab} detection with your own file from the tools above.
                </p>
              </div>
            )}
          </div>

          {/* Right: Report preview */}
          <div className="rounded-[24px] bg-surface border border-border p-6 md:p-8 min-h-[280px]">
            <AnimatePresence mode="wait">
              {demoState === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[232px] flex items-center justify-center text-center text-sm text-text-muted"
                >
                  Run the AI content detection analysis to see a sample trust verification report.
                </motion.div>
              )}

              {demoState !== 'idle' && (
                <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <div className="flex items-center gap-6 mb-6">
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="rgba(160,174,192,0.15)" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r={RING_RADIUS} fill="none"
                          stroke="rgb(244,63,94)" strokeWidth="8" strokeLinecap="round"
                          className="progress-ring-circle"
                          style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-black text-text-primary tabular-nums">
                          {demoState === 'complete' ? `${confidence}%` : '—'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">AI Confidence</div>
                      {demoState === 'complete' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose/10 text-rose border border-rose/30">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> High Risk — Likely AI-Generated
                        </span>
                      )}
                    </div>
                  </div>

                  {demoState === 'complete' && (
                    <>
                      <div className="mb-6">
                        <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">Forensic Evidence</div>
                        <ul className="space-y-2">
                          {EVIDENCE.map((e, i) => (
                            <motion.li
                              key={e}
                              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + i * 0.15, duration: 0.4 }}
                              className="text-sm text-text-secondary leading-relaxed pl-4 border-l-2 border-rose/30"
                            >
                              {e}
                            </motion.li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        title="Sample report — full downloads are available from a real scan"
                        className="rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors"
                      >
                        <Download className="w-4 h-4" aria-hidden="true" /> Download Trust Verification Report
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
