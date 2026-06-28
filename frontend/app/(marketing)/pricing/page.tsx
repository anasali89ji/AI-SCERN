'use client'
import Link from 'next/link'
import { Check, X, Zap, Building2, Users, Info } from 'lucide-react'
import { useState } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/components/auth-provider'
import { SiteNav } from '@/components/SiteNav'

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
    description: 'For individuals who need full detection power.',
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
  { label: 'Scans per day',     key: 'scansPerDay',  tooltip: 'Resets at midnight UTC' },
  { label: 'Max file size',     key: 'fileSizeMB',   format: (v: any) => typeof v === 'number' ? `${v} MB` : String(v) },
  { label: 'Scan history',      key: 'historyDays',  format: (v: any) => typeof v === 'number' ? `${v} days` : String(v) },
  { label: 'API calls / month', key: 'apiCalls',     format: (v: any) => v === 0 ? '—' : String(v) },
  { label: 'Modalities',        key: 'modalities',   format: (v: any) => Array.isArray(v) ? v.join(', ') : String(v) },
  { label: 'Batch size',        key: 'batchSize',    format: (v: any) => v == null ? '—' : `${v} files` },
  { label: 'Support',           key: 'support' },
]

const FAQ = [
  { q: 'Is the free tier permanent?',      a: 'Yes. We believe access to basic AI detection should not require a subscription. The free tier is permanent.' },
  { q: 'Do you store my content?',         a: 'Files are processed and immediately deleted. We do not store your text or media files for analysis purposes. Scan metadata is retained per your plan\'s history limit.' },
  { q: 'Can I cancel anytime?',            a: 'Yes. Monthly plans cancel anytime. You keep Pro access until the end of your billing period with no hidden fees.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards. Invoiced billing available on Team and Enterprise plans.' },
  { q: 'Is there a student or educator discount?', a: 'Yes. Contact us at edu@aiscern.com with your institutional email and intended use for 50% off any plan.' },
]

export default function PricingPage() {
  const { user }  = useAuth()
  const [yearly, setYearly] = useState(false)

  return (
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
              Transparent Pricing
            </p>
            <h1 className="text-[40px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-4">
              Simple, honest pricing
            </h1>
            <p className="text-[#A3A3A3] text-lg max-w-xl mx-auto">
              Start free, upgrade when you need more. No hidden fees, no vendor lock-in.
            </p>

            {/* Toggle */}
            <div className="inline-flex items-center gap-3 mt-8 p-1 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
              <button
                onClick={() => setYearly(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                  !yearly ? 'bg-[#2BEE34] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 ${
                  yearly ? 'bg-[#2BEE34] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-white'
                }`}
              >
                Yearly
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2BEE34]/20 text-[#2BEE34]">
                  -33%
                </span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {TIERS.map(tier => (
              <div
                key={tier.name}
                className={`relative rounded-xl border p-6 flex flex-col transition-all duration-200 ${
                  tier.highlight
                    ? 'border-[#2BEE34] bg-[#2BEE34]/[0.04] shadow-[0_0_30px_rgba(43,238,52,0.12)]'
                    : 'border-[#1E1E1E] bg-[#141414] hover:border-[#2A2A2A]'
                }`}
              >
                {tier.label && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2
                                  px-3 py-1 rounded-full bg-[#2BEE34] text-[#0A0A0A]
                                  text-xs font-bold whitespace-nowrap">
                    {tier.label}
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white mb-1">{tier.name}</h2>
                  <p className="text-sm text-[#6B6B6B] leading-relaxed">{tier.description}</p>
                </div>

                <div className="mb-6">
                  {tier.monthlyPrice === null ? (
                    <div className="text-3xl font-black text-white">Custom</div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-black text-white">
                        ${yearly ? tier.yearlyPrice : tier.monthlyPrice}
                      </span>
                      {tier.monthlyPrice > 0 && (
                        <span className="text-[#6B6B6B] text-sm mb-1">/ mo</span>
                      )}
                    </div>
                  )}
                  {tier.monthlyPrice !== null && tier.monthlyPrice > 0 && yearly && (
                    <p className="text-xs text-[#2BEE34] mt-1">Billed annually</p>
                  )}
                </div>

                <Link
                  href={tier.ctaHref}
                  className={`block text-center px-4 py-2.5 rounded-lg text-sm font-semibold
                              transition-all duration-150 mb-6 ${
                    tier.highlight
                      ? 'bg-[#2BEE34] text-[#0A0A0A] hover:bg-[#1A8F1F]'
                      : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]'
                  }`}
                >
                  {tier.cta}
                </Link>

                <ul className="space-y-2.5 flex-1">
                  {FEATURE_ROWS.map(row => {
                    const val = (tier.limits as any)[row.key]
                    const display = row.format ? row.format(val) : String(val)
                    return (
                      <li key={row.key} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-[#2BEE34] shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-[#A3A3A3]">
                          <span className="text-white font-medium">{display}</span>{' '}
                          {row.label.toLowerCase()}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="mb-16">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#2BEE34]" />
              Full Feature Comparison
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#1E1E1E]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E] bg-[#0A0A0A]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                      Feature
                    </th>
                    {TIERS.map(t => (
                      <th key={t.name} className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                        t.highlight ? 'text-[#2BEE34]' : 'text-[#6B6B6B]'
                      }`}>
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row, ri) => (
                    <tr key={row.key}
                      className={`border-b border-[#1E1E1E] last:border-0 ${ri % 2 === 0 ? 'bg-[#141414]' : 'bg-[#0A0A0A]'}`}
                    >
                      <td className="px-4 py-3 text-[#A3A3A3]">{row.label}</td>
                      {TIERS.map(t => {
                        const val = (t.limits as any)[row.key]
                        const display = row.format ? row.format(val) : String(val)
                        return (
                          <td key={t.name} className={`px-4 py-3 text-center tabular-nums ${
                            t.highlight ? 'text-[#2BEE34] font-medium' : 'text-[#E5E5E5]'
                          }`}>
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
          <div className="mb-16 p-8 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#1A1A1A] border border-[#2A2A2A]">
                <Building2 className="w-6 h-6 text-[#2BEE34]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1">Enterprise</h2>
                <p className="text-sm text-[#A3A3A3]">
                  Custom limits, dedicated SLA, DPA, and a named account manager.
                </p>
              </div>
            </div>
            <a
              href="mailto:sales@aiscern.com"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-lg
                         bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold
                         text-sm transition-colors duration-150"
            >
              Contact Sales
            </a>
          </div>

          {/* FAQ */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white mb-6">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div key={i} className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-5">
                  <p className="font-medium text-white mb-2">{item.q}</p>
                  <p className="text-sm text-[#A3A3A3] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-[#6B6B6B]">
              More questions?{' '}
              <Link href="/faq" className="text-[#2BEE34] hover:underline">Visit the full FAQ</Link>
              {' '}or{' '}
              <a href="mailto:hello@aiscern.com" className="text-[#2BEE34] hover:underline">email us</a>.
            </p>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
