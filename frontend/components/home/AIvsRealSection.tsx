'use client'

import { useState } from 'react'
import Image from 'next/image'
import { XCircle, CheckCircle2, FileText, ImageIcon, Music, Video } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tab = 'text' | 'image' | 'audio' | 'video'

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'text',  label: 'Text',  icon: FileText  },
  { key: 'image', label: 'Image', icon: ImageIcon },
  { key: 'audio', label: 'Audio', icon: Music     },
  { key: 'video', label: 'Video', icon: Video     },
]

const TEXT_EXAMPLE = {
  ai: 'The implementation of advanced machine learning algorithms has fundamentally transformed the paradigm of data processing and cognitive frameworks across all domains, enabling unprecedented synergies between computational efficiency and analytical depth.',
  human: "I burned my toast again. Third time this week. My smoke alarm and I have a complicated relationship at this point — it screams, I wave a dish towel around like an idiot, the whole kitchen smells like regret.",
}

// Module 9.2 note: using the spec's abstract-geometric / nature Unsplash pair here instead
// of the local /public/compare/ai-portrait-01 & real-face-01 assets — those are exactly the
// "ai-face" / "portrait" files flagged for removal later, no reason to lean on them further.
const IMAGE_EXAMPLE = {
  ai:    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
  human: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
}

// Deterministic pseudo-waveform bars — no audio/video assets needed for the placeholder UI.
function seededBars(seed: number, count: number) {
  let x = seed
  return Array.from({ length: count }, () => {
    x = (x * 9301 + 49297) % 233280
    return 20 + (x / 233280) * 80
  })
}
const AI_BARS    = seededBars(7, 40)
const HUMAN_BARS = seededBars(13, 40)

function Waveform({ bars, color }: { bars: number[]; color: string }) {
  return (
    <div className="flex items-center gap-[2px] h-16" aria-hidden="true">
      {bars.map((h, i) => (
        <span key={i} className="flex-1 rounded-full" style={{ height: `${h}%`, backgroundColor: color, opacity: 0.6 }} />
      ))}
    </div>
  )
}

function VerdictLabel({ isAI }: { isAI: boolean }) {
  return isAI ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
      <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> AI Generated
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Human Created
    </span>
  )
}

export default function AIvsRealSection() {
  const [tab, setTab] = useState<Tab>('text')

  return (
    <section className="py-16 sm:py-24 border-t border-white/[0.06] overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-headline text-silver-900 mb-3">AI vs Authentic Content</h2>
          <p className="text-silver-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            How Aiscern distinguishes synthetic content from human originals.
          </p>
        </div>

        {/* Tab bar */}
        <div role="tablist" aria-label="Content type" className="flex justify-center gap-1 mb-8">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50',
                tab === t.key
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-silver-600 hover:text-silver-800 border border-transparent',
              )}
            >
              <t.icon className="w-4 h-4" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Split pane */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* AI side */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-5 overflow-hidden">
            <div className="mb-3"><VerdictLabel isAI /></div>

            {tab === 'text' && (
              <p className="text-sm text-silver-600 leading-relaxed border-l-4 border-rose-500/30 pl-3 italic">
                &ldquo;{TEXT_EXAMPLE.ai}&rdquo;
              </p>
            )}
            {tab === 'image' && (
              <div className="relative h-48 rounded-lg overflow-hidden bg-depth-bg">
                <Image src={IMAGE_EXAMPLE.ai} alt="Abstract geometric pattern, representative of AI-generated imagery" fill sizes="(max-width:640px) 90vw, 45vw" className="object-cover" loading="lazy" />
              </div>
            )}
            {(tab === 'audio' || tab === 'video') && (
              <div className="py-4">
                <Waveform bars={AI_BARS} color="#FF4444" />
                <p className="text-xs text-silver-600 mt-3">Synthetic {tab} — irregular spectral signature detected</p>
              </div>
            )}
          </div>

          {/* Human side */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 overflow-hidden">
            <div className="mb-3"><VerdictLabel isAI={false} /></div>

            {tab === 'text' && (
              <p className="text-sm text-silver-600 leading-relaxed border-l-4 border-emerald-500/30 pl-3 italic">
                &ldquo;{TEXT_EXAMPLE.human}&rdquo;
              </p>
            )}
            {tab === 'image' && (
              <div className="relative h-48 rounded-lg overflow-hidden bg-depth-bg">
                <Image src={IMAGE_EXAMPLE.human} alt="Natural fog over a landscape, representative of authentic photography" fill sizes="(max-width:640px) 90vw, 45vw" className="object-cover" loading="lazy" />
              </div>
            )}
            {(tab === 'audio' || tab === 'video') && (
              <div className="py-4">
                <Waveform bars={HUMAN_BARS} color="#2BEE34" />
                <p className="text-xs text-silver-600 mt-3">Authentic {tab} — natural spectral variance</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-silver-600 mt-6">
          Illustrative example — try the live attestation tool above for real results.
        </p>
      </div>
    </section>
  )
}
