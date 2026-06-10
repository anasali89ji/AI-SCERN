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
    color: 'border-border',
    highlight: false,
    cta: 'Start Free',
    ctaHref: '/signup',
    ctaStyle: 'border border-border text-text-secondary hover:border-primary/50 hover:text-text-primary',
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
    color: 'border-primary/60',
    highlight: true,
    cta: 'Upgrade to Pro',
    ctaHref: '/signup?plan=pro',
    ctaStyle: 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25',
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
    color: 'border-border',
    highlight: false,
    cta: 'Start Team Trial',
    ctaHref: '/signup?plan=team',
    ctaStyle: 'border border-border text-text-secondary hover:border-primary/50 hover:text-text-primary',
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
    color: 'border-border',
    highlight: false,
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@aiscern.com',
    ctaStyle: 'border border-border text-text-secondary hover:border-primary/50 hover:text-text-primary',
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
  { label: 'Scans per day',             key: 'scansPerDay',  tooltip: 'Resets at midnight UTC' },
  { label: 'Max file size',             key: 'fileSizeMB',   format: (v: number | string) => typeof v === 'number' ? `${v} MB` : String(v) },
  { label: 'Scan history',              key: 'historyDays',  format: (v: number | string) => typeof v === 'number' ? `${v} days` : String(v) },
  { label: 'API calls / month',         key: 'apiCalls',     format: (v: number | string) => v === 0 ? '—' : String(v) },
  { label: 'Batch scan size',           key: 'batchSize',    format: (v: number | string | null) => !v ? '—' : `${v} files` },
  { label: 'Support',                   key: 'support' },
]

const BINARY_FEATURES = [
  { label: 'Text detection',                      free: true,  pro: true,  team: true,  enterprise: true  },
  { label: 'Image detection',                     free: true,  pro: true,  team: true,  enterprise: true  },
  { label: 'Audio detection',                     free: false, pro: true,  team: true,  enterprise: true  },
  { label: 'Video / deepfake detection',          free: false, pro: true,  team: true,  enterprise: true  },
  { label: 'Web scraper / URL scanner',           free: true,  pro: true,  team: true,  enterprise: true  },
  { label: 'ARIA AI chat assistant',              free: true,  pro: true,  team: true,  enterprise: true  },
  { label: 'PDF report export',                   free: false, pro: true,  team: true,  enterprise: true  },
  { label: 'API access',                          free: false, pro: true,  team: true,  enterprise: true  },
  { label: 'Shared team workspace',               free: false, pro: false, team: true,  enterprise: true  },
  { label: 'SSO / SAML',                         free: false, pro: false, team: false, enterprise: true  },
  { label: 'Custom retention policy',             free: false, pro: false, team: false, enterprise: true  },
  { label: 'DPA / GDPR documentation',           free: false, pro: false, team: true,  enterprise: true  },
  { label: 'SLA (99.9% uptime guarantee)',        free: false, pro: false, team: false, enterprise: true  },
  { label: 'Dedicated onboarding',               free: false, pro: false, team: false, enterprise: true  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const [yearly, setYearly] = useState(false)

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] px-4 sm:px-6 2xl:px-10 py-16 sm:py-24 2xl:py-32">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-text-primary mb-3">Simple, transparent pricing</h1>
          <p className="text-text-muted max-w-xl mx-auto mb-6">Start free — no credit card required. Upgrade when you need more scans, modalities, or API access.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-2">
            <button onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-text-primary' : 'text-text-muted'}`}>Monthly</button>
            <button
              onClick={() => setYearly(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${yearly ? 'bg-primary' : 'bg-border'}`}
              aria-label="Toggle yearly billing"
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${yearly ? 'translate-x-5' : ''}`} />
            </button>
            <button onClick={() => setYearly(true)} className={`text-sm font-semibold transition-colors ${yearly ? 'text-text-primary' : 'text-text-muted'}`}>
              Yearly <span className="text-emerald text-xs ml-1">Save 33%</span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {TIERS.map(tier => (
            <div key={tier.name} className={`relative rounded-2xl border ${tier.color} ${tier.highlight ? 'bg-primary/5' : 'bg-surface'} p-6 flex flex-col`}>
              {tier.label && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold whitespace-nowrap">{tier.label}</div>
              )}
              <div className="mb-4">
                <h2 className="font-black text-text-primary text-lg">{tier.name}</h2>
                <p className="text-text-muted text-xs mt-1">{tier.description}</p>
              </div>
              <div className="mb-6">
                {tier.monthlyPrice === null ? (
                  <p className="text-2xl font-semibold font-display text-text-primary">Custom</p>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-semibold font-display text-text-primary">${yearly ? tier.yearlyPrice : tier.monthlyPrice}</span>
                    <span className="text-text-muted text-sm mb-1">/mo</span>
                  </div>
                )}
                {yearly && tier.monthlyPrice !== null && tier.monthlyPrice > 0 && (
                  <p className="text-xs text-emerald mt-1">Billed ${(tier.yearlyPrice! * 12)} / year</p>
                )}
              </div>

              {/* Key limits */}
              <div className="space-y-2 mb-6 flex-1">
                <LimitRow label="Scans/day" value={String(tier.limits.scansPerDay)} />
                <LimitRow label="File size" value={typeof tier.limits.fileSizeMB === 'number' ? `${tier.limits.fileSizeMB} MB` : String(tier.limits.fileSizeMB)} />
                <LimitRow label="History" value={typeof tier.limits.historyDays === 'number' ? `${tier.limits.historyDays} days` : String(tier.limits.historyDays)} />
                <LimitRow label="API calls/mo" value={tier.limits.apiCalls === 0 ? '—' : String(tier.limits.apiCalls)} />
                <LimitRow label="Modalities" value={tier.limits.modalities.length === 2 ? 'Text + Image' : 'All 4'} />
              </div>

              <Link href={user && tier.name === 'Free' ? '/dashboard' : tier.ctaHref}
                className={`block text-center rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${tier.ctaStyle}`}>
                {user && tier.name === 'Free' ? 'Go to Dashboard' : tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Full comparison table */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-text-primary mb-6 text-center">Full Feature Comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-text-muted font-semibold text-xs uppercase tracking-wide w-48">Feature</th>
                  {TIERS.map(t => (
                    <th key={t.name} className={`px-4 py-3 text-center font-bold text-xs uppercase tracking-wide ${t.highlight ? 'text-primary' : 'text-text-muted'}`}>{t.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Limit rows */}
                {FEATURE_ROWS.map(row => (
                  <tr key={row.key} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 text-text-secondary flex items-center gap-1.5">
                      {row.label}
                      {row.tooltip && <span title={row.tooltip} className="text-text-muted cursor-help"><Info className="w-3 h-3" /></span>}
                    </td>
                    {TIERS.map(tier => {
                      const raw = tier.limits[row.key as keyof typeof tier.limits]
                      const display = row.format ? row.format(raw as never) : String(raw)
                      return (
                        <td key={tier.name} className={`px-4 py-3 text-center tabular-nums ${tier.highlight ? 'text-primary font-semibold' : 'text-text-secondary'}`}>
                          {display}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {/* Binary feature rows */}
                {BINARY_FEATURES.map(feat => (
                  <tr key={feat.label} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-text-secondary">{feat.label}</td>
                    {(['free', 'pro', 'team', 'enterprise'] as const).map(plan => (
                      <td key={plan} className="px-4 py-3 text-center">
                        {feat[plan]
                          ? <Check className="w-4 h-4 text-emerald mx-auto" />
                          : <X className="w-4 h-4 text-text-disabled mx-auto" />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rate limits note */}
        <div className="rounded-xl border border-border bg-surface p-6 mb-12">
          <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-amber" />API Rate Limits</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm text-text-secondary">
            <div>
              <p className="font-semibold text-text-primary mb-1">Pro</p>
              <ul className="space-y-1">
                <li>10 requests / minute</li>
                <li>500 requests / month</li>
                <li>Max payload: 50 MB</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-1">Team</p>
              <ul className="space-y-1">
                <li>60 requests / minute</li>
                <li>5,000 requests / month</li>
                <li>Max payload: 100 MB</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-1">Enterprise</p>
              <ul className="space-y-1">
                <li>Custom rate limits</li>
                <li>Unlimited requests</li>
                <li>Max payload: 500 MB</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <Building2 className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Need Enterprise?</h3>
          <p className="text-text-muted text-sm mb-4 max-w-md mx-auto">
            Custom scan limits, SSO/SAML, dedicated onboarding, SLA, GDPR DPA, and volume pricing.
            For HR, legal, journalism, and government organisations.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:sales@aiscern.com" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors">
              <Users className="w-4 h-4" /> Contact Sales
            </a>
            <Link href="/dpa" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-primary/40 transition-colors">
              View DPA
            </Link>
          </div>
        </div>

      </main>
      <SiteFooter />
    </>
  )
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  )
}
