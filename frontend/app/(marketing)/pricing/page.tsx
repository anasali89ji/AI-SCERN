import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Zap, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Free AI Detector — No Subscription Required | Aiscern',
  description: 'Aiscern is 100% free. Detect AI text, deepfakes, audio clones, and synthetic images with no limits, no sign-up required.',
  alternates: { canonical: 'https://aiscern.com/pricing' },
}

const features = [
  'AI Text Detection (unlimited)',
  'Deepfake Image Detection (unlimited)',
  'AI Audio & Voice Clone Detection',
  'Deepfake Video Detection',
  'Batch Scanning',
  'Web Scanner',
  'AI Assistant / Chat',
  'Scan History (when signed in)',
  'No ads, no tracking, no paywalls',
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background py-20 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">

        {/* Header */}
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
            <Zap className="w-4 h-4" /> 100% Free · No Credit Card
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-text-primary">
            Always <span className="gradient-text">Free</span>
          </h1>
          <p className="text-lg text-text-muted max-w-lg mx-auto">
            Aiscern is free and open — no subscriptions, no scan limits, no paywalls.
            We built this to help people spot AI-generated content, not to monetize trust.
          </p>
        </div>

        {/* Free card */}
        <div className="card p-8 border-primary/30 space-y-6 text-left">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-xl font-black text-text-primary">Everything Included</span>
              </div>
              <p className="text-text-muted text-sm">No tiers. No limits. Just detection.</p>
            </div>
            <div className="text-right">
              <span className="text-4xl font-black gradient-text">$0</span>
              <span className="text-text-muted text-sm">/forever</span>
            </div>
          </div>

          <ul className="space-y-3">
            {features.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm text-text-secondary">
                <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/detect/text"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors">
              <Zap className="w-4 h-4" /> Start Detecting Free
            </Link>
            <a href="/docs/api"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-surface-hover transition-colors">
              Read the Docs →
            </a>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-text-disabled">
          We may add optional supporter tiers in the future to fund model training costs —
          but core detection will always remain free.
        </p>
      </div>
    </main>
  )
}
