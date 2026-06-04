import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'

export const metadata: Metadata = {
  title: 'Roadmap — Aiscern',
  description: 'What we are building at Aiscern. Current status, next 3 months, and known limitations.',
}

const CURRENT = [
  'Text AI detection using 3-model RoBERTa ensemble (~85% accuracy)',
  'Image detection using ViT + CLIP ensemble (~82% accuracy)',
  'Audio deepfake detection via wav2vec2 (~79% accuracy)',
  'Video frame-level deepfake analysis (~76% accuracy — experimental)',
  'Batch scanning up to 20 files simultaneously',
  'Shareable scan result links',
  'ARIA AI detection assistant (chat)',
  'Free tier with 10 scans/day — no account required',
]

const NEXT_3_MONTHS = [
  { done: false, item: 'Improve audio detection accuracy on WaveFake benchmarks' },
  { done: false, item: 'Launch PDF report export for Pro users' },
  { done: false, item: 'Release public REST API for Team plans' },
  { done: false, item: 'Video temporal consistency improvements' },
  { done: false, item: 'Stripe billing integration for Pro and Team plans' },
  { done: false, item: 'Public leaderboard with per-model accuracy breakdown' },
]

const LIMITATIONS = [
  { title: 'Video detection is experimental', desc: '~76% accuracy. Short clips and low-resolution video are less reliable. Do not use for high-stakes decisions alone.' },
  { title: 'Short audio clips are unreliable', desc: 'Clips under 5 seconds do not give the model enough signal. Results on very short audio should be treated as indicative only.' },
  { title: 'Non-native English may trigger false positives', desc: 'Text detection models were primarily trained on English. Non-native phrasing patterns can sometimes appear machine-like to the model.' },
  { title: 'Human-edited AI content is harder to detect', desc: 'When AI output has been manually edited or paraphrased, detection accuracy drops. There is no perfect detector.' },
  { title: 'Results are probabilistic, not definitive', desc: 'All verdicts come with a confidence score. Use human judgment alongside Aiscern results for any consequential decision.' },
]

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main className="pt-28 pb-24 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-semibold mb-5">
              <Clock className="w-3 h-3" /> Product Roadmap
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-text-primary mb-4">
              What We Are <span className="gradient-text">Building</span>
            </h1>
            <p className="text-text-muted text-base leading-relaxed">
              Aiscern is built by a solo founder. This page is an honest record of what works, what is coming, and where we fall short.
            </p>
          </div>

          {/* Current Status */}
          <section className="mb-14">
            <h2 className="text-xl font-black text-text-primary mb-5 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald" /> Current Status
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3">
              {CURRENT.map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Next 3 Months */}
          <section className="mb-14">
            <h2 className="text-xl font-black text-text-primary mb-5 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" /> Next 3 Months
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3">
              {NEXT_3_MONTHS.map(({ item }) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Known Limitations */}
          <section className="mb-14">
            <h2 className="text-xl font-black text-text-primary mb-5 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber" /> Known Limitations
            </h2>
            <div className="space-y-3">
              {LIMITATIONS.map(({ title, desc }) => (
                <div key={title} className="rounded-xl border border-amber/20 bg-amber/4 p-4">
                  <p className="text-sm font-bold text-text-primary mb-1">{title}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer note */}
          <div className="rounded-xl border border-border/60 bg-surface/40 p-5 flex items-start justify-between gap-4 flex-wrap">
            <p className="text-xs text-text-muted">
              Last updated: <strong className="text-text-secondary">April 2026</strong> · Built by Anas Ali in Islamabad, Pakistan.
            </p>
            <Link href="/methodology" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              See accuracy methodology <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
