'use client'
import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle, Mail } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'

const FAQ_SECTIONS = [
  {
    title: 'Pricing & Plans',
    items: [
      {
        q: 'Is there really a free plan?',
        a: 'Yes. The free tier includes 10 scans per day on text and image detection. No credit card required.',
        link: { label: 'See all pricing plans', href: '/pricing' },
      },
      {
        q: 'What happens if I hit my daily limit?',
        a: 'You can wait for the next day or upgrade to Pro instantly. Your scan count resets every 24 hours.',
        link: null,
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes. Monthly plans cancel anytime with no hidden fees. You keep Pro access until the end of your billing period.',
        link: null,
      },
      {
        q: 'Will the free tier stay?',
        a: 'Yes. We believe everyone deserves access to basic AI detection. The free tier is permanent.',
        link: null,
      },
      {
        q: 'Why do you charge for Pro and Team?',
        a: 'Running ensemble AI models across text, image, audio, and video requires significant GPU compute. Paid plans help us improve accuracy, add new modalities, and keep the service running — without selling your data or showing ads.',
        link: null,
      },
    ],
  },
  {
    title: 'Detection & Accuracy',
    items: [
      {
        q: 'How accurate is Aiscern?',
        a: 'Our latest benchmarks show approximately 85% accuracy on text, 82% on images, 79% on audio, and 76% on video. Accuracy varies by content type, generator, and compression level. These are measured on public held-out test sets — not cherry-picked results.',
        link: { label: 'View full methodology', href: '/methodology' },
      },
      {
        q: 'Can I use Aiscern for legal or academic decisions?',
        a: 'No. Detection results are probabilistic, not definitive. Always use human judgment for high-stakes decisions. Never use a single detection result as sole evidence in legal proceedings or academic integrity cases.',
        link: null,
      },
      {
        q: 'What AI generators can you detect?',
        a: 'Our models are updated quarterly. We detect content from major generators including ChatGPT, GPT-4, Claude, Midjourney, DALL-E, Stable Diffusion, ElevenLabs, and common TTS tools. Novel generators released after our last update may evade detection until the next fine-tune.',
        link: null,
      },
      {
        q: 'How does the ensemble work?',
        a: 'We run content through multiple independent detection signals and combine them into a single confidence score. No single model makes the final call — results are cross-verified before delivering a verdict.',
        link: { label: 'Full detection methodology', href: '/methodology' },
      },
      {
        q: 'What does an "Uncertain" verdict mean?',
        a: 'An "Uncertain" result means the ensemble did not reach ≥62% confidence to label AI, nor ≤38% to label human. This is not a failure — it means the content is genuinely ambiguous. Try running a longer sample or checking a different modality.',
        link: null,
      },
      {
        q: 'Does Aiscern work on languages other than English?',
        a: 'Text detection was primarily trained on English-language data. Non-English text may produce higher false-positive rates. Treat non-English results with extra caution. Multilingual support is on the roadmap.',
        link: null,
      },
    ],
  },
  {
    title: 'Privacy & Data',
    items: [
      {
        q: 'What happens to my uploads?',
        a: 'Files are processed for detection and deleted within 24 hours. We do not train our models on your content without explicit opt-in. Scan results are stored in your history for 12 months.',
        link: { label: 'Read privacy policy', href: '/privacy' },
      },
      {
        q: 'Do you sell my data?',
        a: 'No. We do not sell, share, or use your submitted content for any purpose other than providing the detection service to you.',
        link: null,
      },
    ],
  },
  {
    title: 'Product',
    items: [
      {
        q: 'Who built Aiscern?',
        a: 'Aiscern is built by Anas Ali, a solo founder based in Mandi Bahauddin, Pakistan. It is an early-stage project — actively developed, transparent about limitations, and not VC-funded.',
        link: { label: 'About the founder', href: '/about' },
      },
      {
        q: 'Do you have an API?',
        a: 'Yes. API access is available on Team and Enterprise plans. Documentation is available at /docs/api.',
        link: { label: 'View API docs', href: '/docs/api' },
      },
      {
        q: 'What file types do you support?',
        a: 'Text (paste or URL), images (JPG, PNG, WEBP), audio (MP3, WAV, M4A), and video (MP4, MOV, WEBM).',
        link: null,
      },
    ],
  },
]

function FAQItem({ q, a, link }: { q: string; a: string; link: { label: string; href: string } | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/[0.08] last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 group"
      >
        <span className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">{q}</span>
        <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-5">
              <p className="text-sm text-text-muted leading-relaxed mb-3">{a}</p>
              {link && (
                <Link href={link.href} className="text-xs text-primary hover:underline font-medium">
                  {link.label} →
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <SiteNav />

      <main className="pt-28 pb-20 max-w-2xl 2xl:max-w-3xl mx-auto px-4 sm:px-6 2xl:px-8">

        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-semibold mb-5">
            <HelpCircle className="w-3.5 h-3.5" />
            Frequently Asked Questions
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h1>
          <p className="text-text-muted text-base">
            Everything you need to know about Aiscern. Can&apos;t find what you are looking for?{' '}
            <a href="mailto:contact@aiscern.com" className="text-primary hover:underline">
              Contact us at contact@aiscern.com
            </a>
          </p>
        </div>

        <div className="space-y-8 mb-12">
          {FAQ_SECTIONS.map(section => (
            <div key={section.title}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1 px-1">
                {section.title}
              </h2>
              <div className="rounded-xl border border-white/[0.08] bg-surface px-6">
                {section.items.map(item => (
                  <FAQItem key={item.q} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center rounded-xl border border-white/[0.08] bg-surface/50 p-8">
          <Mail className="w-8 h-8 text-primary mx-auto mb-3 opacity-80" />
          <p className="text-sm font-semibold text-text-primary mb-1">Still have questions?</p>
          <p className="text-xs text-text-muted mb-4">We respond within 24–48 hours.</p>
          <a
            href="mailto:contact@aiscern.com"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.08] text-sm font-semibold text-text-secondary hover:border-primary/50 hover:text-text-primary transition-all"
          >
            contact@aiscern.com
          </a>
        </div>

      </main>
      <SiteFooter />
    </div>
  )
}
