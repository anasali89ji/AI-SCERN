'use client'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, Zap, Shield, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/components/auth-provider'

const features = [
  'AI Text Detection — unlimited scans',
  'Deepfake Image Detection — unlimited',
  'AI Audio & Voice Clone Detection',
  'Deepfake Video Detection',
  'Batch Scan up to 20 files at once',
  'Web Scanner / URL analysis',
  'AI Detection Assistant (chat)',
  'Scan history saved when signed in',
  'No ads · No tracking · No paywalls',
]

export default function PricingPage() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Aiscern" width={36} height={25}
              className="object-contain drop-shadow-[0_0_6px_rgba(245,100,0,0.4)]" priority />
            <span className="font-black text-xl gradient-text">Aiscern</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            <Link href="/#tools" className="hover:text-text-primary transition-colors">Tools</Link>
            <Link href="/reviews" className="hover:text-text-primary transition-colors">Reviews</Link>
            <Link href="/docs/api" className="hover:text-text-primary transition-colors">API</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link href="/dashboard" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all">Dashboard →</Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:flex px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-hover transition-all">Sign In</Link>
                <Link href="/signup" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                  <Zap className="w-3.5 h-3.5" /><span className="hidden sm:inline">Get Started</span><span className="sm:hidden">Join</span>
                </Link>
              </>
            )}
            <button className="md:hidden p-2 rounded-lg hover:bg-surface text-text-muted" onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 px-4 py-4 flex flex-col gap-3">
            <Link href="/#tools" onClick={() => setMobileOpen(false)} className="text-sm text-text-muted hover:text-text-primary py-2">Tools</Link>
            <Link href="/reviews" onClick={() => setMobileOpen(false)} className="text-sm text-text-muted hover:text-text-primary py-2">Reviews</Link>
            <Link href="/docs/api" onClick={() => setMobileOpen(false)} className="text-sm text-text-muted hover:text-text-primary py-2">API</Link>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="pt-28 pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
              <Zap className="w-4 h-4" /> 100% Free · No Credit Card Ever
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-text-primary">
              Always <span className="gradient-text">Free</span>
            </h1>
            <p className="text-lg text-text-muted max-w-lg mx-auto">
              No subscriptions, no scan limits, no paywalls. Built to help people spot AI-generated content — not to monetize trust.
            </p>
          </div>

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
                  <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href={user ? '/dashboard' : '/signup'}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors">
                <Zap className="w-4 h-4" />{user ? 'Go to Dashboard' : 'Start Detecting Free'}
              </Link>
              <Link href="/docs/api"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-surface-hover transition-colors">
                Read the Docs →
              </Link>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            We may add optional supporter tiers in the future to fund model training — but core detection will always remain free.
          </p>
        </div>
      </main>
      
        {/* Revenue Roadmap */}
        <section className="py-16 px-4 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">For <span className="gradient-text">Organizations</span></h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              Core detection will always be free. These optional tiers support continued model training and infrastructure.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { name: 'API Access', tag: 'Coming Soon', color: 'border-primary/30 bg-primary/5',
                features: ['Programmatic API access','Higher rate limits for applications','All 4 detection modalities','Webhook support','Dedicated email support'] },
              { name: 'Enterprise', tag: 'Contact Us', color: 'border-emerald/30 bg-emerald/5',
                features: ['Custom volume agreements','SLA guarantees','Priority model updates','Custom model fine-tuning','Dedicated account manager'] },
            ].map(tier => (
              <div key={tier.name} className={`rounded-2xl border p-6 ${tier.color}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-lg text-text-primary">{tier.name}</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-surface border border-border text-text-muted">{tier.tag}</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                      <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="mailto:contact@aiscern.com"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:border-primary/50 transition-all">
                  Contact Us
                </a>
              </div>
            ))}
          </div>
        </section>

      <SiteFooter />
    </div>
  )
}
