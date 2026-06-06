import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'
import { Tag, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Changelog — Aiscern',
  description: 'Version history and release notes for Aiscern. Active development log.',
}

type ChangeType = 'improvement' | 'fix' | 'new' | 'infra'

const RELEASES: {
  version: string
  date: string
  summary: string
  changes: { type: ChangeType; text: string }[]
}[] = [
  {
    version: 'v4.1.0',
    date: 'April 2026',
    summary: 'Updated image detection model and audio accuracy improvements.',
    changes: [
      { type: 'improvement', text: 'Improved audio detection accuracy to ~79% on WaveFake benchmark' },
      { type: 'improvement', text: 'Updated image ViT ensemble with additional GAN artifact training' },
      { type: 'new',         text: 'PDF report export for Pro users (beta)' },
      { type: 'fix',         text: 'Fixed video detection timeout for clips longer than 2 minutes' },
      { type: 'fix',         text: 'Fixed broken video fallback that was suppressing AI verdicts' },
      { type: 'infra',       text: 'Migrated rate limiter to persistent storage — resets correctly across cold starts' },
    ],
  },
  {
    version: 'v4.0.0',
    date: 'March 2026',
    summary: 'Major ensemble rewrite. Detection signal logic overhauled across all modalities.',
    changes: [
      { type: 'new',         text: 'Complete rewrite of detection signal logic in hf-analyze.ts (v5.0.0)' },
      { type: 'improvement', text: 'Multi-model consensus now weights by modality — no single model dominates verdict' },
      { type: 'improvement', text: 'Text detection ensemble updated with DeBERTa-v3-base' },
      { type: 'new',         text: 'Audio detection added (ElevenLabs, common TTS tools, voice clones)' },
      { type: 'fix',         text: 'Fixed image buffer truncation that was corrupting files sent to HuggingFace' },
      { type: 'fix',         text: 'Fixed duplicate database writes on concurrent scans' },
      { type: 'fix',         text: 'Fixed in-memory rate limiter resetting on Vercel cold starts' },
    ],
  },
  {
    version: 'v3.2.0',
    date: 'February 2026',
    summary: 'Batch processing, API access, and scan history.',
    changes: [
      { type: 'new',         text: 'Batch scan — process up to 20 files simultaneously' },
      { type: 'new',         text: 'REST API v1 endpoint for text detection (Team+)' },
      { type: 'new',         text: 'Scan history saved for signed-in users' },
      { type: 'improvement', text: 'Confidence threshold tuned: ≥62% AI, ≤38% Human' },
      { type: 'fix',         text: 'Hero card CSS opacity bug fixed on mobile Safari' },
      { type: 'fix',         text: 'API key management — fake validation removed, real key auth implemented' },
    ],
  },
  {
    version: 'v3.0.0',
    date: 'January 2026',
    summary: 'Video detection added (experimental). ARIA detection assistant launched.',
    changes: [
      { type: 'new',         text: 'Video deepfake detection — experimental, ~76% accuracy' },
      { type: 'new',         text: 'ARIA — AI Detection Assistant chatbot' },
      { type: 'new',         text: 'Scan share links — shareable results with one click' },
      { type: 'improvement', text: 'Image detection improved with CLIP-based signal analysis' },
    ],
  },
  {
    version: 'v2.0.0',
    date: 'December 2025',
    summary: 'Initial public launch. Text and image detection live.',
    changes: [
      { type: 'new', text: 'Text detection (RoBERTa ensemble) — ~85% accuracy' },
      { type: 'new', text: 'Image detection (ViT + GAN artifacts) — ~82% accuracy' },
      { type: 'new', text: 'Free tier live — 10 scans/day, no credit card required' },
      { type: 'new', text: 'Methodology page published with accuracy benchmarks' },
    ],
  },
]

const TYPE_CONFIG: Record<ChangeType, { label: string; style: string }> = {
  new:         { label: 'New',         style: 'bg-primary/10 text-primary border border-primary/25' },
  improvement: { label: 'Improved',    style: 'bg-emerald/10 text-emerald border border-emerald/25' },
  fix:         { label: 'Fix',         style: 'bg-amber/10 text-amber border border-amber/25' },
  infra:       { label: 'Infra',       style: 'bg-surface text-text-muted border border-border' },
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <SiteNav />

      <main className="pt-28 pb-20 max-w-2xl mx-auto px-4">

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-semibold mb-5">
            <Tag className="w-3.5 h-3.5" />
            Version History
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">
            <span className="gradient-text">Changelog</span>
          </h1>
          <p className="text-text-muted text-base">
            A chronological record of what has shipped. Aiscern is actively maintained — this page updates with every release.
          </p>
        </div>

        <div className="space-y-10">
          {RELEASES.map((release, i) => (
            <div key={release.version} className="relative pl-6 border-l-2 border-border">
              {/* Version dot */}
              <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-primary" />

              <div className="mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-semibold text-text-primary">{release.version}</span>
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Calendar className="w-3 h-3" /> {release.date}
                  </div>
                  {i === 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald/10 text-emerald border border-emerald/25 uppercase tracking-wider">
                      Latest
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-1">{release.summary}</p>
              </div>

              <ul className="space-y-2">
                {release.changes.map((c, j) => {
                  const cfg = TYPE_CONFIG[c.type]
                  return (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${cfg.style}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm text-text-secondary leading-relaxed">{c.text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-text-muted">
            Found a bug or want to suggest a feature?{' '}
            <Link href="/contact" className="text-primary hover:underline">Contact us</Link>
            {' '}or check the{' '}
            <Link href="/roadmap" className="text-primary hover:underline">roadmap</Link>.
          </p>
        </div>

      </main>
      <SiteFooter />
    </div>
  )
}
