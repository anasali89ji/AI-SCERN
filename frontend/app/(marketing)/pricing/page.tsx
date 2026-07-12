'use client'
import Link from 'next/link'
import { Check, Building2, Users, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'
import { cn } from '@/lib/cn'

const TIERS = [
  {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    label: null,
    description: 'Get started instantly — no credit card required.',
    highlight: false,
    cta: 'Start Free',
    ctaHref: '/signup',
    limits: {
      scansPerDay: 10,
      fileSizeMB: 10,
      historyDays: 7,
      apiCalls: 0,
      modalities: ['Text', 'Image'],
      batchSize: null,
      support: 'Community',
    },
  },
  {
    name: 'Pro',
    monthlyPrice: 12,
    yearlyPrice: 8,
    label: 'Most Popular',
    description: 'For individuals who need full attestation power.',
    highlight: true,
    cta: 'Upgrade to Pro',
    ctaHref: '/signup?plan=pro',
    limits: {
      scansPerDay: 100,
      fileSizeMB: 50,
      historyDays: 365,
      apiCalls: 500,
      modalities: ['Text', 'Image', 'Audio', 'Video'],
      batchSize: 20,
      support: 'Email (48h)',
    },
  },
  {
    name: 'Team',
    monthlyPrice: 49,
    yearlyPrice: 35,
    label: null,
    description: 'Shared workspace for teams. API included.',
    highlight: false,
    cta: 'Start Team Trial',
    ctaHref: '/signup?plan=team',
    limits: {
      scansPerDay: 500,
      fileSizeMB: 100,
      historyDays: 365,
      apiCalls: 5000,
      modalities: ['Text', 'Image', 'Audio', 'Video'],
      batchSize: 50,
      support: 'Priority (24h)',
    },
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    label: null,
    description: 'Custom limits, SLA, DPA, and dedicated support.',
    highlight: false,
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@aiscern.com',
    limits: {
      scansPerDay: 'Unlimited',
      fileSizeMB: 500,
      historyDays: 'Custom',
      apiCalls: 'Unlimited',
      modalities: ['Text', 'Image', 'Audio', 'Video'],
      batchSize: 100,
      support: 'Dedicated SLA',
    },
  },
]

const FEATURE_ROWS = [
  { label: 'Scans per day',       key: 'scansPerDay' },
  { label: 'Max file size',       key: 'fileSizeMB',   format: (v: any) => typeof v === 'number' ? `${v} MB` : String(v) },
  { label: 'Attestation history', key: 'historyDays',  format: (v: any) => typeof v === 'number' ? `${v} days` : String(v) },
  { label: 'API calls / month',   key: 'apiCalls',     format: (v: any) => v === 0 ? '—' : String(v) },
  { label: 'Modalities',          key: 'modalities',   format: (v: any) => Array.isArray(v) ? v.join(', ') : String(v) },
  { label: 'Batch size',          key: 'batchSize',    format: (v: any) => v == null ? '—' : `${v} files` },
  { label: 'Support',             key: 'support' },
]

const FAQ = [
  { q: 'Is the free tier permanent?',      a: 'Yes. We believe access to basic AI attestation should not require a subscription. The free tier is permanent.' },
  { q: 'Do you store my content?',         a: "Files are processed and immediately deleted. We do not store your text or media files for analysis purposes. Attestation metadata is retained per your plan's history limit." },
  { q: 'Can I cancel anytime?',            a: 'Yes. Monthly plans cancel anytime. You keep Pro access until the end of your billing period with no hidden fees.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards. Invoiced billing available on Team and Enterprise plans.' },
  { q: 'Is there a student or educator discount?', a: 'Yes. Contact us at edu@aiscern.com with your institutional email and intended use for 50% off any plan.' },
]

function PriceTag({ tier, yearly }: { tier: typeof TIERS[number]; yearly: boolean }) {
  if (tier.monthlyPrice === null) {
    return <div className="text-3xl font-bold text-silver-900">Custom</div>
  }
  const price = yearly ? tier.yearlyPrice : tier.monthlyPrice
  return (
    <div className="flex items-end gap-1 h-9 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={price}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="text-3xl font-bold text-silver-900"
        >
          ${price}
        </motion.span>
      </AnimatePresence>
      {(tier.monthlyPrice ?? 0) > 0 && <span className="text-silver-600 text-sm mb-1">/ mo</span>}
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-5 text-left focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg"
      >
        <span className="font-medium text-silver-900">{q}</span>
        <ChevronDown className={cn('w-4 h-4 text-silver-600 shrink-0 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-silver-600 leading-relaxed pb-5">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false)

  return (
    <div className="min-h-screen bg-surface text-silver-700">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">
              Transparent Pricing
            </p>
            <h1 className="text-display text-silver-900 mb-4">
              Simple, honest pricing
            </h1>
            <p className="text-lead text-silver-600 max-w-xl mx-auto">
              Start free, upgrade when you need more. No hidden fees, no vendor lock-in.
            </p>

            {/* Toggle — sliding pill switch */}
            <div className="inline-flex items-center gap-3 mt-8">
              <span className={cn('text-sm font-medium transition-colors duration-200', !yearly ? 'text-silver-900' : 'text-silver-600')}>
                Monthly
              </span>
              <button
                role="switch"
                aria-checked={yearly}
                aria-label="Toggle yearly billing"
                onClick={() => setYearly(y => !y)}
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50',
                  yearly ? 'bg-accent' : 'bg-surface-elevated border border-white/[0.12]',
                )}
              >
                <motion.span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                  animate={{ left: yearly ? '26px' : '2px' }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </button>
              <span className={cn('text-sm font-medium transition-colors duration-200 flex items-center gap-2', yearly ? 'text-silver-900' : 'text-silver-600')}>
                Yearly
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                  -33%
                </span>
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {TIERS.map(tier => (
              <div
                key={tier.name}
                className={cn(
                  'relative rounded-xl border p-6 flex flex-col transition-all duration-200',
                  tier.highlight
                    ? 'border-accent/20 bg-accent/[0.04] shadow-glow'
                    : 'border-white/[0.06] bg-surface hover:border-white/[0.12]',
                )}
              >
                {tier.label && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2
                                  px-3 py-1 rounded-full bg-accent text-depth-bg
                                  text-xs font-bold whitespace-nowrap">
                    {tier.label}
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-silver-900 mb-1">{tier.name}</h2>
                  <p className="text-sm text-silver-600 leading-relaxed">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <PriceTag tier={tier} yearly={yearly} />
                  {tier.monthlyPrice !== null && tier.monthlyPrice > 0 && yearly && (
                    <p className="text-xs text-accent mt-1">Billed annually</p>
                  )}
                </div>

                <Link
                  href={tier.ctaHref}
                  className={cn(
                    'block text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 mb-6 focus-visible:ring-2 focus-visible:ring-accent/50',
                    tier.highlight
                      ? 'bg-accent text-depth-bg hover:bg-accent-hover'
                      : 'bg-surface-elevated border border-white/[0.08] text-silver-700 hover:border-accent hover:text-accent',
                  )}
                >
                  {tier.cta}
                </Link>

                <ul className="space-y-2.5 flex-1">
                  {FEATURE_ROWS.map(row => {
                    const val = (tier.limits as any)[row.key]
                    const display = row.format ? row.format(val) : String(val)
                    return (
                      <li key={row.key} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                        <span className="text-silver-600">
                          <span className="text-silver-900 font-medium">{display}</span>{' '}
                          {row.label.toLowerCase()}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Comparison table — sticky header */}
          <div className="mb-16">
            <h2 className="text-xl font-semibold text-silver-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" aria-hidden="true" />
              Full Feature Comparison
            </h2>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06] max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/[0.06] bg-depth-bg">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-silver-600">
                      Feature
                    </th>
                    {TIERS.map(t => (
                      <th key={t.name} className={cn(
                        'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider',
                        t.highlight ? 'text-accent' : 'text-silver-600',
                      )}>
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map(row => (
                    <tr key={row.key} className="border-b border-white/[0.06] last:border-0 hover:bg-surface-elevated transition-colors duration-150">
                      <td className="px-4 py-3 text-silver-600">{row.label}</td>
                      {TIERS.map(t => {
                        const val = (t.limits as any)[row.key]
                        const display = row.format ? row.format(val) : String(val)
                        return (
                          <td key={t.name} className={cn(
                            'px-4 py-3 text-center tabular-nums',
                            t.highlight ? 'text-accent font-medium' : 'text-silver-800',
                          )}>
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enterprise */}
          <div className="mb-16 p-8 rounded-xl border border-white/[0.06] bg-depth-bg flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-surface-elevated border border-white/[0.08]">
                <Building2 className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-silver-900 mb-1">Enterprise</h2>
                <p className="text-sm text-silver-600">
                  Custom limits, dedicated SLA, DPA, and a named account manager.
                </p>
              </div>
            </div>
            <a
              href="mailto:sales@aiscern.com"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-lg
                         bg-accent hover:bg-accent-hover text-depth-bg font-semibold
                         text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Contact Sales
            </a>
          </div>

          {/* FAQ — real accordion */}
          <div>
            <h2 className="text-xl font-semibold text-silver-900 mb-6">Frequently Asked Questions</h2>
            <div className="rounded-xl border border-white/[0.06] bg-surface px-5">
              {FAQ.map(item => <FAQItem key={item.q} q={item.q} a={item.a} />)}
            </div>
            <p className="mt-6 text-sm text-silver-600">
              More questions?{' '}
              <Link href="/faq" className="text-accent hover:underline">Visit the full FAQ</Link>
              {' '}or{' '}
              <a href="mailto:hello@aiscern.com" className="text-accent hover:underline">email us</a>.
            </p>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
