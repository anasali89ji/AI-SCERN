'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Kept identical to the FAQPage JSON-LD in app/page.tsx on purpose — Google's
// rich-result guidelines require FAQ structured data to match content that's
// actually visible on the page. Previously this schema had no matching UI at all.
const FAQS = [
  {
    q: 'How accurate is Aiscern?',
    a: 'Aiscern uses a 14-layer ensemble combining ViT classifiers, RoBERTa, wav2vec2, and physics-based signal analysis. Benchmarked accuracy: text ~94%, image ~98%, audio ~91%, video ~88%. Full methodology and numbers are on the benchmarks page.',
  },
  {
    q: 'Is Aiscern free?',
    a: 'Yes. There\u2019s a free tier with 10 scans per day on text and image detection, no credit card required. Pro plans unlock audio, video, and higher limits.',
  },
  {
    q: 'Can Aiscern detect ChatGPT writing?',
    a: 'Yes \u2014 ChatGPT, Claude, Gemini, GPT-4, and other AI writing models, using a 3-model RoBERTa ensemble with linguistic signal analysis.',
  },
  {
    q: 'Can Aiscern detect Midjourney images?',
    a: 'Yes \u2014 Midjourney, DALL-E 3, Stable Diffusion, SDXL, FLUX, Gemini, and Grok images, using a 14-layer ensemble including physics-based Bayer pattern analysis.',
  },
  {
    q: 'Does Aiscern have an API?',
    a: 'Yes, on Team and Enterprise plans. See the API docs for authentication, endpoints, and rate limits.',
  },
] as const

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-14 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/[0.06]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-silver-600 mb-2.5 sm:mb-3">
            FAQ
          </p>
          <h2 className="text-headline text-silver-900">
            Common questions
          </h2>
        </div>

        <div className="space-y-2.5">
          {FAQS.map((item, i) => {
            const open = openIndex === i
            return (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.06] bg-surface overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  aria-controls={`faq-panel-${i}`}
                  className="w-full flex items-center justify-between gap-4 text-left
                             px-4 sm:px-5 py-4 min-h-[56px]
                             focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
                >
                  <span className="text-sm sm:text-base font-medium text-silver-900">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-silver-600 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {/* Grid-rows trick for a smooth height auto animation without JS measuring */}
                <div
                  id={`faq-panel-${i}`}
                  className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-4 sm:px-5 pb-4 text-sm text-silver-600 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
