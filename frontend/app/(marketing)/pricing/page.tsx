'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, X, Zap, Shield, Crown, Building2, Loader2 } from 'lucide-react'
import Link from 'next/link'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/10',
    monthlyPrice: 9.99,
    yearlyPrice: 99,
    credits: 100,
    popular: false,
    features: [
      'Text AI Detection',
      'Image Deepfake Detection',
      'Audio Detection',
      '100 scans/month',
      '30-day history',
      'Batch scan (up to 10)',
      'Email support',
    ],
    missing: ['Video Detection', 'API Access', 'Priority support', 'White-label'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Shield,
    color: 'text-primary',
    border: 'border-primary/50',
    glow: 'shadow-primary/20',
    monthlyPrice: 29.99,
    yearlyPrice: 299,
    credits: 500,
    popular: true,
    features: [
      'Everything in Starter',
      'Video Deepfake Detection',
      '500 scans/month',
      '365-day history',
      'API Access (X-API-Key)',
      'Batch scan (unlimited)',
      'Sentence-level heatmaps',
      'Priority email support',
    ],
    missing: ['White-label', 'SLA guarantee', 'Dedicated manager'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Crown,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/10',
    monthlyPrice: 99.99,
    yearlyPrice: 999,
    credits: -1,
    popular: false,
    features: [
      'Everything in Pro',
      'Unlimited scans',
      'Unlimited history',
      'White-label option',
      '99.9% SLA guarantee',
      'SSO / SAML',
      'Custom integrations',
      'Dedicated account manager',
    ],
    missing: [],
  },
]

const FAQS = [
  { q: 'What counts as a scan?', a: 'Each text analysis, image, audio, or video file you submit counts as 1 scan. Credits reset on the 1st of every month.' },
  { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Upgrades apply immediately. Downgrades take effect at the end of your current billing period.' },
  { q: 'Is there a free trial?', a: 'Every new account starts with 5 free scans — no credit card required. You can upgrade at any time.' },
  { q: 'How accurate is the detection?', a: 'Our models achieve 94% accuracy on text, 97% on images, 91% on audio, and 88% on video. Results are continually improving as our dataset grows.' },
  { q: 'Do you offer refunds?', a: 'Yes — 30-day money-back guarantee on all paid plans, no questions asked.' },
  { q: 'Is my data kept private?', a: 'Absolutely. Scanned content is processed and deleted immediately. We never store or train on your data without consent.' },
]

export default function PricingPage() {
  const [yearly, setYearly]     = useState(false)
  const [loading, setLoading]   = useState<string | null>(null)
  const router = useRouter()

  const handleUpgrade = async (planId: string) => {
    setLoading(planId)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval: yearly ? 'yearly' : 'monthly' }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
      if (res.status === 401) { router.push('/login?returnTo=/pricing'); return }
      alert(data.error || 'Failed to start checkout')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <Link href="/" className="text-xl font-black gradient-text">DETECTAI</Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-20">
        {/* Hero */}
        <div className="text-center space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-black">
              Simple, <span className="gradient-text">Transparent</span> Pricing
            </h1>
            <p className="text-text-muted text-lg mt-3 max-w-xl mx-auto">
              Start free with 5 scans. Upgrade as your needs grow. Cancel anytime.
            </p>
          </motion.div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm ${!yearly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>Monthly</span>
            <button onClick={() => setYearly(!yearly)}
              className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-primary' : 'bg-border'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${yearly ? 'translate-x-6' : ''}`} />
            </button>
            <span className={`text-sm ${yearly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
              Yearly <span className="text-green-400 font-bold ml-1">Save 17%</span>
            </span>
          </div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice
            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border p-6 flex flex-col gap-5 ${plan.border} bg-surface shadow-xl ${plan.glow} ${plan.popular ? 'ring-2 ring-primary' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-white text-xs font-bold">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-surface-active flex items-center justify-center ${plan.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">{plan.credits === -1 ? 'Unlimited' : plan.credits + '/mo'} scans</p>
                    <h3 className="font-bold text-text-primary">{plan.name}</h3>
                  </div>
                </div>

                <div>
                  <span className="text-4xl font-black text-text-primary">${price}</span>
                  <span className="text-text-muted text-sm ml-1">/{yearly ? 'year' : 'month'}</span>
                  {yearly && <p className="text-xs text-green-400 mt-1">vs ${(plan.monthlyPrice * 12).toFixed(2)}/year monthly</p>}
                </div>

                <button onClick={() => handleUpgrade(plan.id)} disabled={!!loading}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-primary hover:bg-primary/90 text-white'
                      : 'border border-border hover:bg-surface-active text-text-primary'
                  } disabled:opacity-50`}>
                  {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading === plan.id ? 'Loading…' : 'Get Started'}
                </button>

                <div className="space-y-2.5">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-text-secondary">{f}</span>
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <X className="w-4 h-4 text-text-muted/40 flex-shrink-0 mt-0.5" />
                      <span className="text-text-muted/50">{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap justify-center gap-8 text-sm text-text-muted">
          {['✓ Cancel anytime', '✓ 30-day money-back guarantee', '✓ No setup fees', '✓ Secure payments by Stripe'].map(t => (
            <span key={t} className="text-text-secondary">{t}</span>
          ))}
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
          <Building2 className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-black">Need Enterprise Scale?</h2>
          <p className="text-text-muted max-w-lg mx-auto">Custom pricing, white-label, SSO/SAML, SLA, dedicated support, on-premise option.</p>
          <a href="mailto:sales@detectai.io"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">
            Contact Sales
          </a>
        </div>

        {/* FAQ */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-center">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border bg-surface p-5">
                <h3 className="font-semibold text-text-primary mb-2">{q}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
