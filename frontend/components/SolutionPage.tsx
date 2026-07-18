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

// Token-only palette. `primary`/`cyan` map to the site accent (moss green);
// `blue` is kept as a distinct hue for visual variety across the 9 subpages,
// using Tailwind's core blue scale (not a raw hex value). `amber`, `emerald`,
// `rose` reuse the verdict-color classes already safelisted in tailwind.config.
const colorMap = {
  primary: {
    badge: 'bg-accent/10 border-accent/20 text-accent',
    iconBg: 'bg-accent/10 border-accent/20',
    icon: 'text-accent',
    glow: 'bg-accent/10',
    check: 'text-accent',
  },
  cyan: {
    badge: 'bg-accent/10 border-accent/20 text-accent',
    iconBg: 'bg-accent/10 border-accent/20',
    icon: 'text-accent',
    glow: 'bg-accent/10',
    check: 'text-accent',
  },
  blue: {
    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    icon: 'text-blue-400',
    glow: 'bg-blue-500/10',
    check: 'text-blue-400',
  },
  amber: {
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    icon: 'text-amber-400',
    glow: 'bg-amber-500/10',
    check: 'text-amber-400',
  },
  emerald: {
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: 'text-emerald-400',
    glow: 'bg-emerald-500/10',
    check: 'text-emerald-400',
  },
  rose: {
    badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    icon: 'text-rose-400',
    glow: 'bg-rose-500/10',
    check: 'text-rose-400',
  },
} as const

function FAQ({ faqs }: { faqs: SolutionFAQ[] }) {
  return (
    <div className="divide-y divide-white/5">
      {faqs.map((faq, i) => (
        <details key={i} className="group py-4">
          <summary className="flex items-center justify-between cursor-pointer list-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-md">
            <span className="text-sm font-semibold text-silver-900 pr-4">{faq.q}</span>
            <ChevronDown className="w-4 h-4 text-silver-600 flex-shrink-0 group-open:rotate-180 transition-transform duration-300" />
          </summary>
          <p className="mt-3 text-sm text-silver-600 leading-relaxed">{faq.a}</p>
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
      <main className="min-h-screen bg-surface-deep pt-16">

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
              description: `Ensemble-based AI attestation for ${industry} professionals.`,
            }),
          }}
        />

        {/* Hero — main's pt-16 already clears the fixed nav (64px), so this
            section's own vertical padding shouldn't stack another 80px on
            top on mobile: 64+80=144px of dead space before the headline
            eats a fifth of a phone's visible height before the fold. */}
        <section className="relative pt-8 pb-14 md:py-28 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl ${c.glow}`} />
          </div>
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 relative">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-12">
              <div className="flex-1 text-center lg:text-left">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-6 ${c.badge}`}>
                  <Zap className="w-3.5 h-3.5" />
                  {industry} Solution
                </div>
                <h1 className="text-headline text-silver-900 mb-4">
                  {tagline}
                </h1>
                <p className="text-lead text-silver-600 mb-8 max-w-xl mx-auto lg:mx-0">
                  {description}
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start">
                  <Link href="/signup" className="btn-primary w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-accent/50">
                    {ctaLabel} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/detect/text" className="btn-secondary w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-accent/50">
                    Try Free Demo
                  </Link>
                </div>
                <p className="mt-4 text-xs text-silver-600">No credit card required · Free tier always available</p>
              </div>
              {/* Abstract geometric illustration */}
              <div className="flex-shrink-0 w-36 h-36 sm:w-48 sm:h-48 lg:w-64 lg:h-64">
                <div className={`relative w-full h-full mx-auto rounded-xl border ${c.iconBg} flex items-center justify-center`}>
                  <span className={c.icon}>{heroIcon}</span>
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center">
                    <CheckCircle className={`w-4 h-4 ${c.icon}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem */}
        <section className="py-12 md:py-20 border-t border-white/5">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl font-semibold text-silver-900 mb-3">{problemTitle}</h2>
              <p className="text-silver-600 text-sm md:text-base max-w-xl mx-auto">The AI content problem is getting harder to solve. Here&apos;s what professionals in {industry.toLowerCase()} face every day.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
              {painPoints.map((p, i) => (
                <div key={i} className="bg-surface border border-white/5 p-5 rounded-xl">
                  <h3 className="font-semibold text-silver-900 mb-2 text-sm">{p.title}</h3>
                  <p className="text-sm text-silver-600 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Aiscern Solves It */}
        <section className="py-12 md:py-20 bg-surface-elevated border-y border-white/5">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl font-semibold text-silver-900 mb-3">How Aiscern Solves It</h2>
              <p className="text-silver-600 text-sm md:text-base max-w-xl mx-auto">
                Our ensemble-based attestation pipeline combines 8+ specialized models with a confidence threshold system.
                <Link href="/methodology" className="text-accent hover:underline ml-1 focus-visible:ring-2 focus-visible:ring-accent/50 rounded">Learn about our methodology →</Link>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {features.map((f, i) => (
                <div key={i} className="bg-surface p-5 rounded-xl border border-white/5 hover:border-white/10 transition-colors duration-300">
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} border flex items-center justify-center mb-4 ${c.icon}`}>
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-silver-900 text-sm mb-2">{f.title}</h3>
                  <p className="text-xs text-silver-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Accuracy disclaimer */}
            <p className="mt-6 text-xs text-silver-600 text-center border border-white/5 rounded-lg p-3 max-w-xl mx-auto">
              Accuracy varies by content type and model generation date. Results are probabilistic — use alongside human judgment.
              <Link href="/methodology" className="text-accent hover:underline ml-1 focus-visible:ring-2 focus-visible:ring-accent/50 rounded">See full benchmarks →</Link>
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-12 md:py-20">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-silver-900 mb-8 md:mb-10 text-center">Real-World Use Cases</h2>
            <div className="grid sm:grid-cols-3 gap-4 md:gap-6">
              {useCases.map((uc, i) => (
                <div key={i} className="relative p-6 rounded-xl border border-white/5 bg-surface">
                  <div className={`text-4xl font-bold mb-3 ${c.icon} opacity-30`}>0{i + 1}</div>
                  <h3 className="font-semibold text-silver-900 mb-2">{uc.title}</h3>
                  <p className="text-sm text-silver-600 leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        {testimonialQuote && (
          <section className="py-10 md:py-12 bg-surface-elevated border-y border-white/5">
            <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
              <blockquote className="text-base md:text-lg text-silver-600 italic leading-relaxed mb-4">
                &ldquo;{testimonialQuote}&rdquo;
              </blockquote>
              {testimonialAuthor && (
                <cite className="not-italic text-sm text-silver-600">
                  <span className="text-silver-900 font-medium">{testimonialAuthor}</span>
                  {testimonialRole && <span>, {testimonialRole}</span>}
                </cite>
              )}
              {!testimonialAuthor && (
                <div className="text-sm text-silver-600">
                  <Link href="/reviews" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent/50 rounded">Be among the first to leave a review →</Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="py-12 md:py-20">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-silver-900 mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="bg-surface border border-white/5 rounded-xl p-5 md:p-6">
              <FAQ faqs={faqs} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 md:py-20 border-t border-white/5">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-silver-900 mb-4">
              Ready to attest content in {industry.toLowerCase()}?
            </h2>
            <p className="text-silver-600 text-sm md:text-base mb-8">
              Start with a free account — no credit card, no commitment. Upgrade when you need more attestations.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
              <Link href="/signup" className="btn-primary w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-accent/50">
                {ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="btn-secondary w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-accent/50">View Pricing</Link>
              <Link href="/about" className="btn-ghost w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-accent/50">About Aiscern</Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  )
}
