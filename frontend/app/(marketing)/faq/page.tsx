'use client'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, Mail, ArrowRight } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'

const FAQ_SECTIONS = [
  {
    title: 'Pricing & Plans',
    items: [
      { q: 'Is there really a free plan?',           a: 'Yes. The free tier includes 10 scans per day on text and image detection. No credit card required.',                           link: { label: 'See all pricing plans', href: '/pricing' } },
      { q: 'What happens if I hit my daily limit?',  a: 'You can wait for the next day or upgrade to Pro instantly. Your scan count resets every 24 hours.',                           link: null },
      { q: 'Can I cancel anytime?',                  a: 'Yes. Monthly plans cancel anytime with no hidden fees. You keep Pro access until the end of your billing period.',            link: null },
      { q: 'Will the free tier stay?',               a: 'Yes. We believe everyone deserves access to basic AI detection. The free tier is permanent.',                                  link: null },
      { q: 'Why do you charge for Pro and Team?',    a: 'Running ensemble AI models across text, image, audio, and video requires significant GPU compute. Paid plans help us improve accuracy, add new modalities, and keep the service running — without selling your data or showing ads.', link: null },
    ],
  },
  {
    title: 'Detection & Accuracy',
    items: [
      { q: 'How accurate is Aiscern?',               a: 'Our latest benchmarks show approximately 94% accuracy on text, 98% on images (14-layer ensemble including physics-based signals), 92% on audio, and 90% on video. Accuracy varies by content type, generator, and compression level. These are measured on public held-out test sets — not cherry-picked results. See /benchmarks for full breakdown.',                                          link: { label: 'View full methodology', href: '/methodology' } },
      { q: 'Can I use Aiscern for legal or academic decisions?', a: 'No. Detection results are probabilistic, not definitive. Always use human judgment for high-stakes decisions. Never use a single detection result as sole evidence in legal proceedings or academic integrity cases.', link: null },
      { q: 'What AI generators can you detect?',     a: 'Our models are updated quarterly. We detect content from major generators including ChatGPT, GPT-4, Claude, Midjourney, DALL-E, Stable Diffusion, ElevenLabs, and common TTS tools. Novel generators released after our last update may evade detection until the next fine-tune.', link: null },
      { q: 'How does the ensemble work?',            a: 'We run content through multiple independent detection signals and combine them into a single confidence score. No single model makes the final call — results are cross-verified before delivering a verdict.',                                                                                        link: { label: 'Read the methodology', href: '/methodology' } },
      { q: 'Does Aiscern work in languages other than English?', a: 'Text detection works best in English. We have partial support for Spanish, French, German, and Arabic. Image, audio, and video detection are language-agnostic.', link: null },
    ],
  },
  {
    title: 'Privacy & Security',
    items: [
      { q: 'Does Aiscern store my content?',         a: 'Files and text submitted for detection are processed and immediately deleted. We do not use your content to train models. Metadata (verdict, confidence score, timestamp) is stored per your plan\'s scan history setting.', link: { label: 'Read our Privacy Policy', href: '/privacy' } },
      { q: 'Is my API key secure?',                  a: 'API keys are stored as hashed values. We never log your key in plaintext. You can rotate or revoke keys anytime from your dashboard.', link: null },
      { q: 'Is Aiscern GDPR compliant?',             a: 'Yes. Aiscern is operated as a sole proprietorship by Anas Ali in Pakistan. We process data in compliance with GDPR principles for EU users. You can request deletion of all your data at any time.', link: { label: 'View GDPR policy', href: '/gdpr' } },
    ],
  },
  {
    title: 'API & Integration',
    items: [
      { q: 'Is there an API?',                       a: 'Yes. API access is included on Pro and Team plans. The API supports all four modalities — text, image, audio, and video — with the same ensemble pipeline used in the dashboard.', link: { label: 'View API docs', href: '/docs/api' } },
      { q: 'What file formats does the API accept?', a: 'Text: plain text, PDF, DOCX. Images: JPEG, PNG, WebP, HEIC. Audio: MP3, WAV, M4A, OGG, FLAC. Video: MP4, MOV, WebM. Maximum file sizes vary by plan.',               link: null },
      { q: 'Is there a Python or JavaScript SDK?',   a: 'A community JavaScript SDK is in progress. In the meantime, the REST API is straightforward — see the docs for curl examples.',                                            link: { label: 'View API docs', href: '/docs/api' } },
    ],
  },
]

function AccordionItem({ q, a, link }: { q: string; a: string; link: { label: string; href: string } | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#1E1E1E] last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className={`text-sm font-medium transition-colors duration-150 ${open ? 'text-white' : 'text-[#E5E5E5] group-hover:text-white'}`}>
          {q}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[#6B6B6B] transition-transform duration-200 ${open ? 'rotate-180 text-[#2BEE34]' : ''}`} />
      </button>
      {open && (
        <div className="pb-4 animate-slide-up">
          <p className="text-sm text-[#A3A3A3] leading-relaxed">{a}</p>
          {link && (
            <Link href={link.href} className="mt-2 text-xs text-[#2BEE34] hover:underline font-medium flex items-center gap-1">
              {link.label} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
              Support
            </p>
            <h1 className="text-[40px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-[#A3A3A3] text-lg">
              Everything you need to know about Aiscern.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {FAQ_SECTIONS.map(section => (
              <div key={section.title}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-4">
                  {section.title}
                </h2>
                <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl px-5">
                  {section.items.map(item => (
                    <AccordionItem key={item.q} {...item} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Contact CTA */}
          <div className="mt-14 p-8 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A] text-center">
            <Mail className="w-8 h-8 text-[#2BEE34] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Still have questions?</h2>
            <p className="text-sm text-[#A3A3A3] mb-5">
              Our team usually responds within 48 hours.
            </p>
            <a
              href="mailto:hello@aiscern.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                         bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm
                         transition-colors duration-150"
            >
              <Mail className="w-4 h-4" /> Email Support
            </a>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
