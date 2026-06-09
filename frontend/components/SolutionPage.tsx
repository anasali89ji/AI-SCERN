import type { ReactNode } from 'react'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { ArrowRight, CheckCircle, ChevronDown, Zap } from 'lucide-react'


export interface SolutionFAQ {
  q: string
  a: string
}

export interface SolutionFeature {
  icon: ReactNode
  title: string
  desc: string
}

export interface SolutionUseCase {
  title: string
  desc: string
}

export interface SolutionPainPoint {
  title: string
  desc: string
}

export interface SolutionPageProps {
  industry: string
  tagline: string
  description: string
  heroIcon: ReactNode
  accentColor: 'primary' | 'blue' | 'cyan' | 'amber' | 'emerald' | 'rose'
  ctaLabel: string
  problemTitle: string
  painPoints: SolutionPainPoint[]
  features: SolutionFeature[]
  useCases: SolutionUseCase[]
  faqs: SolutionFAQ[]
  testimonialQuote?: string
  testimonialAuthor?: string
  testimonialRole?: string
}

const colorMap = {
  primary: {
    badge:   'bg-blue-500/10 border-blue-500/20 text-blue-400',
    iconBg:  'bg-blue-500/10 border-blue-500/20',
    icon:    'text-blue-400',
    glow:    'rgba(37,99,235,0.08)',
    heroGlow:'rgba(37,99,235,0.10)',
    check:   'text-blue-400',
    btn:     'bg-blue-600 hover:bg-blue-700',
  },
  blue: {
    badge:   'bg-blue-500/10 border-blue-500/20 text-blue-400',
    iconBg:  'bg-blue-500/10 border-blue-500/20',
    icon:    'text-blue-400',
    glow:    'rgba(37,99,235,0.08)',
    heroGlow:'rgba(37,99,235,0.10)',
    check:   'text-blue-400',
    btn:     'bg-blue-600 hover:bg-blue-700',
  },
  cyan: {
    badge:   'bg-blue-500/10 border-blue-500/20 text-blue-400',
    iconBg:  'bg-blue-500/10 border-blue-500/20',
    icon:    'text-blue-400',
    glow:    'rgba(37,99,235,0.08)',
    heroGlow:'rgba(37,99,235,0.10)',
    check:   'text-blue-400',
    btn:     'bg-blue-600 hover:bg-blue-700',
  },
  amber: {
    badge:   'bg-amber/10 border-amber/20 text-amber',
    iconBg:  'bg-amber/10 border-amber/20',
    icon:    'text-amber',
    glow:    'rgba(245,158,11,0.12)',
    heroGlow:'rgba(245,158,11,0.15)',
    check:   'text-amber',
    btn:     'bg-amber hover:bg-amber/90',
  },
  emerald: {
    badge:   'bg-emerald/10 border-emerald/20 text-emerald',
    iconBg:  'bg-emerald/10 border-emerald/20',
    icon:    'text-emerald',
    glow:    'rgba(16,185,129,0.12)',
    heroGlow:'rgba(16,185,129,0.15)',
    check:   'text-emerald',
    btn:     'bg-emerald hover:bg-emerald/90',
  },
  rose: {
    badge:   'bg-rose/10 border-rose/20 text-rose',
    iconBg:  'bg-rose/10 border-rose/20',
    icon:    'text-rose',
    glow:    'rgba(244,63,94,0.12)',
    heroGlow:'rgba(244,63,94,0.15)',
    check:   'text-rose',
    btn:     'bg-rose hover:bg-rose/90',
  },
}

function FAQ({ faqs }: { faqs: SolutionFAQ[] }) {
  return (
    <div className="divide-y divide-border/40">
      {faqs.map((faq, i) => (
        <details key={i} className="group py-4">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="text-sm font-semibold text-text-primary pr-4">{faq.q}</span>
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0 group-open:rotate-180 transition-transform duration-200" />
          </summary>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">{faq.a}</p>
        </details>
      ))}
    </div>
  )
}

export function SolutionPage(props: SolutionPageProps) {
  const {
    industry, tagline, description, heroIcon, accentColor, ctaLabel,
    problemTitle, painPoints, features, useCases, faqs,
    testimonialQuote, testimonialAuthor, testimonialRole,
  } = props

  const c = colorMap[accentColor]

  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-background pt-16">

        {/* JSON-LD Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Aiscern Multi-Modal AI Detector',
              operatingSystem: 'Web browser',
              applicationCategory: 'UtilitiesApplication',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              description: `Ensemble-based AI detection for ${industry} professionals.`,
            }),
          }}
        />

        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${c.heroGlow} 0%, transparent 60%)` }} />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px]"
              style={{ background: c.glow }} />
          </div>
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 relative">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 text-center lg:text-left">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-6 ${c.badge}`}>
                  <Zap className="w-3.5 h-3.5" />
                  {industry} Solution
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-text-primary mb-4 leading-tight">
                  {tagline}
                </h1>
                <p className="text-lg text-text-secondary mb-8 leading-relaxed max-w-xl">
                  {description}
                </p>
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <Link href="/signup" className="btn-primary">
                    {ctaLabel} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/detect/text" className="btn-secondary">
                    Try Free Demo
                  </Link>
                </div>
                <p className="mt-4 text-xs text-text-muted">No credit card required · Free tier always available</p>
              </div>
              {/* Abstract geometric illustration */}
              <div className="flex-shrink-0 lg:w-64 xl:w-80">
                <div className={`relative w-48 h-48 lg:w-64 lg:h-64 mx-auto rounded-xl border ${c.iconBg.replace('bg-', 'border-').split(' ')[1]} flex items-center justify-center`}
                  style={{ background: `radial-gradient(circle at 30% 30%, ${c.glow}, transparent 70%)` }}>
                  {heroIcon}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface border border-white/[0.08] flex items-center justify-center">
                    <CheckCircle className={`w-4 h-4 ${c.icon}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem */}
        <section className="py-16 md:py-20 border-t border-white/[0.08]/20">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-3">{problemTitle}</h2>
              <p className="text-text-secondary max-w-xl mx-auto">The AI content problem is getting harder to solve. Here&apos;s what professionals in {industry.toLowerCase()} face every day.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {painPoints.map((p, i) => (
                <div key={i} className="card border border-white/[0.08] p-5 rounded-xl">
                  <h3 className="font-semibold text-text-primary mb-2 text-sm">{p.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Aiscern Solves It */}
        <section className="py-16 md:py-20 bg-surface/30">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-3">How Aiscern Solves It</h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                Our ensemble-based detection pipeline combines 8+ specialized models with a confidence threshold system.
                <Link href="/methodology" className="text-primary hover:underline ml-1">Learn about our methodology →</Link>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => {
                return (
                  <div key={i} className="card p-5 rounded-xl border border-white/[0.08] hover:border-primary/20 transition-colors">
                    <div className={`w-10 h-10 rounded-xl ${c.iconBg} border flex items-center justify-center mb-4`}>
                      {f.icon}
                    </div>
                    <h3 className="font-semibold text-text-primary text-sm mb-2">{f.title}</h3>
                    <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
                  </div>
                )
              })}
            </div>

            {/* Accuracy disclaimer */}
            <p className="mt-6 text-xs text-text-muted text-center border border-white/[0.06] rounded-lg p-3 max-w-xl mx-auto">
              ℹ️ Accuracy varies by content type and model generation date. Results are probabilistic — use alongside human judgment.
              <Link href="/methodology" className="text-primary hover:underline ml-1">See full benchmarks →</Link>
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-10 text-center">Real-World Use Cases</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {useCases.map((uc, i) => (
                <div key={i} className="relative p-6 rounded-xl border border-white/[0.08] bg-surface/20">
                  <div className={`text-3xl font-black mb-3 ${c.icon} opacity-30`}>0{i+1}</div>
                  <h3 className="font-semibold text-text-primary mb-2">{uc.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        {testimonialQuote && (
          <section className="py-12 bg-surface/30">
            <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
              <blockquote className="text-lg text-text-secondary italic leading-relaxed mb-4">
                &ldquo;{testimonialQuote}&rdquo;
              </blockquote>
              {testimonialAuthor && (
                <cite className="not-italic text-sm text-text-muted">
                  <span className="text-text-primary font-semibold">{testimonialAuthor}</span>
                  {testimonialRole && <span>, {testimonialRole}</span>}
                </cite>
              )}
              {!testimonialAuthor && (
                <div className="text-sm text-text-muted">
                  <Link href="/reviews" className="text-primary hover:underline">Be among the first to leave a review →</Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="py-16 md:py-20">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="card border border-white/[0.08] rounded-xl p-6">
              <FAQ faqs={faqs} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 border-t border-white/[0.08]/20">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-4">
              Ready to detect AI content in {industry.toLowerCase()}?
            </h2>
            <p className="text-text-secondary mb-8">
              Start with a free account — no credit card, no commitment. Upgrade when you need more scans.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/signup" className="btn-primary">
                {ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="btn-secondary">View Pricing</Link>
              <Link href="/about" className="btn-ghost">About Aiscern</Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  )
}
