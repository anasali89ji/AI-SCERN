'use client'
import Link from 'next/link'
import { CheckCircle, Zap, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/components/auth-provider'
import { SiteNav } from '@/components/SiteNav'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    label: null,
    description: 'Get started with no commitment.',
    color: 'border-border',
    highlight: false,
    features: [
      '10 scans per day',
      'Text detection (~85% accuracy)',
      'Image detection (~82% accuracy)',
      'Basic confidence score',
      '7-day scan history',
    ],
    cta: 'Start Free',
    ctaHref: '/signup',
    ctaStyle: 'border border-border text-text-secondary hover:border-primary/50 hover:text-text-primary',
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    label: 'Most Popular',
    description: 'For individuals who need more power.',
    color: 'border-primary/60',
    highlight: true,
    features: [
      '100 scans per day',
      'All 4 modalities (text, image, audio, video)',
      'Full scan history',
      'PDF report export',
      'Priority processing',
    ],
    cta: 'Upgrade to Pro',
    ctaHref: '/signup?plan=pro',
    ctaStyle: 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25',
  },
  {
    name: 'Team',
    price: '$49',
    period: '/month',
    label: null,
    description: 'For teams that need shared access and API.',
    color: 'border-border',
    highlight: false,
    features: [
      '500 scans per day',
      'Shared workspace',
      'API access (all modalities)',
      'Team analytics dashboard',
      'Priority email support',
    ],
    cta: 'Contact for Team',
    ctaHref: 'mailto:contact@aiscern.com?subject=Team Plan Inquiry',
    ctaStyle: 'border border-border text-text-secondary hover:border-primary/50 hover:text-text-primary',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    label: null,
    description: 'For organizations with high-volume or on-premise needs.',
    color: 'border-emerald/30',
    highlight: false,
    features: [
      'Unlimited scans',
      'On-premise deployment option',
      'Custom model fine-tuning',
      'SLA guarantee',
      'Dedicated support manager',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:enterprise@aiscern.com?subject=Enterprise Inquiry',
    ctaStyle: 'border border-emerald/40 text-emerald hover:border-emerald/70',
  },
]

const FAQS = [
  { q: 'Is there really a free plan?', a: 'Yes. 10 scans per day on text and image detection. No credit card required. No hidden fees.' },
  { q: 'What happens if I hit my daily limit?', a: 'You can wait for the next day (limits reset at midnight UTC) or upgrade to Pro instantly.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Monthly plans cancel anytime from your account settings. No hidden fees or lock-in periods.' },
  { q: 'Will the free tier stay?', a: 'Yes. We believe everyone deserves access to basic AI detection. The free tier is a permanent part of Aiscern.' },
  { q: 'What modalities does each plan include?', a: 'Free covers text and image. Pro and above unlock audio and video detection. All modalities use ensemble models with published accuracy benchmarks.' },
  { q: 'Do you offer refunds?', a: 'Yes. If you are not satisfied within the first 7 days of a paid plan, contact us at contact@aiscern.com for a full refund.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-3 hover:text-text-primary transition-colors"
      >
        <span className="text-sm font-semibold text-text-primary">{q}</span>
        <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
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
            <p className="text-sm text-text-muted leading-relaxed pb-4">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function PricingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main className="pt-28 pb-20 px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-black text-text-primary mb-4">
            Simple, <span className="gradient-text">Transparent</span> Pricing
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Start free. Upgrade when you need more power.
          </p>
        </div>

        {/* Tier grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mb-16">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${tier.color} ${tier.highlight ? 'ring-2 ring-primary/30 bg-primary/4' : 'bg-surface'}`}
            >
              {tier.label && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary text-white shadow-lg shadow-primary/30">
                    {tier.label}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-lg font-black text-text-primary mb-1">{tier.name}</h2>
                <p className="text-text-muted text-xs leading-relaxed mb-3">{tier.description}</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black gradient-text">{tier.price}</span>
                  {tier.period && <span className="text-text-muted text-sm mb-1">{tier.period}</span>}
                </div>
              </div>

              <ul className="flex-1 space-y-2.5 mb-6">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaHref}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${tier.ctaStyle}`}
              >
                {tier.name === 'Free' && <Zap className="w-4 h-4" />}
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Why We Charge */}
        <div className="max-w-2xl mx-auto mb-16 p-6 rounded-2xl border border-border/35 bg-surface/40 text-center">
          <h2 className="text-lg font-black text-text-primary mb-3">Why We Charge</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Running ensemble AI models across text, image, audio, and video requires significant GPU compute.
            Paid plans help us improve accuracy, add new modalities, and keep the service running —
            without selling your data or showing ads.
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-text-primary text-center mb-8">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <div className="rounded-2xl border border-border/60 bg-surface px-6">
            {FAQS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
