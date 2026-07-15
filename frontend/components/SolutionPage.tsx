import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { ArrowRight, CheckCircle, ChevronDown, Zap, Check, X } from 'lucide-react'


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
  challenge: string
  action: string
  outcome: string
}

export interface SolutionPainPoint {
  title: string
  desc: string
}

export interface SolutionTrustStat {
  label: string
  value: string
}

export interface SolutionWorkflowStep {
  title: string
  desc: string
}

export interface SolutionComparisonRow {
  feature: string
  aiscern: string | boolean
  competitor: string | boolean
}

export interface SolutionCaseStudy {
  quote: string
  author: string
  role: string
  company: string
  metric: string
  metricLabel: string
  isPlaceholder?: boolean
}

export interface SolutionPageProps {
  // --- existing (unchanged, kept backward-compatible) ---
  industry: string
  tagline: string
  description: string
  heroIcon: ReactNode
  accentColor: 'primary' | 'cyan' | 'amber' | 'emerald' | 'rose'
  ctaLabel: string
  problemTitle: string
  painPoints: SolutionPainPoint[]
  features: SolutionFeature[]
  useCases: SolutionUseCase[]
  faqs: SolutionFAQ[]
  testimonialQuote?: string
  testimonialAuthor?: string
  testimonialRole?: string

  // --- new, all optional ---
  heroImage?: string
  heroImageAlt?: string
  problemImage?: string
  problemImageAlt?: string
  trustBar?: SolutionTrustStat[]
  workflow?: SolutionWorkflowStep[]
  comparisonCompetitorName?: string
  comparisonRows?: SolutionComparisonRow[]
  caseStudy?: SolutionCaseStudy
}

const colorMap = {
  primary: {
    badge:   'bg-primary/10 border-primary/20 text-primary',
    iconBg:  'bg-primary/10 border-primary/20',
    icon:    'text-primary',
    glow:    'rgba(37,99,235,0.12)',
    heroGlow:'rgba(37,99,235,0.15)',
    check:   'text-primary',
    btn:     'bg-primary hover:bg-primary/90',
  },
  cyan: {
    badge:   'bg-cyan/10 border-cyan/20 text-cyan',
    iconBg:  'bg-cyan/10 border-cyan/20',
    icon:    'text-cyan',
    glow:    'rgba(6,182,212,0.12)',
    heroGlow:'rgba(6,182,212,0.15)',
    check:   'text-cyan',
    btn:     'bg-cyan hover:bg-cyan/90',
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
    heroImage, heroImageAlt, problemImage, problemImageAlt,
    trustBar, workflow, comparisonCompetitorName, comparisonRows, caseStudy,
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
              {heroImage ? (
                <div className="flex-shrink-0 w-full lg:w-[45%]">
                  <div className="solution-hero-image relative w-full aspect-[16/10]">
                    <Image
                      src={heroImage}
                      alt={heroImageAlt || `${industry} professional using Aiscern`}
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 45vw"
                    />
                  </div>
                </div>
              ) : (
                /* Abstract geometric illustration (fallback when no photo is supplied) */
                <div className="flex-shrink-0 lg:w-64 xl:w-80">
                  <div className={`relative w-48 h-48 lg:w-64 lg:h-64 mx-auto rounded-3xl border ${c.iconBg.replace('bg-', 'border-').split(' ')[1]} flex items-center justify-center`}
                    style={{ background: `radial-gradient(circle at 30% 30%, ${c.glow}, transparent 70%)` }}>
                    {heroIcon}
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
                      <CheckCircle className={`w-4 h-4 ${c.icon}`} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        {trustBar && trustBar.length > 0 && (
          <section className="solution-trust-bar py-8">
            <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
              <div className={`grid grid-cols-2 gap-6 ${
                trustBar.length >= 4 ? 'sm:grid-cols-4' : trustBar.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              }`}>
                {trustBar.map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className={`text-2xl md:text-3xl font-black ${c.icon}`}>{stat.value}</div>
                    <div className="mt-1 text-xs text-text-muted uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* The Problem */}
        <section className="py-16 md:py-20 border-t border-border/20">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="flex flex-col lg:flex-row items-center gap-10 mb-12">
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-3">{problemTitle}</h2>
                <p className="text-text-secondary max-w-xl mx-auto lg:mx-0">The AI content problem is getting harder to solve. Here&apos;s what professionals in {industry.toLowerCase()} face every day.</p>
              </div>
              {problemImage && (
                <div className="flex-shrink-0 w-full lg:w-[45%]">
                  <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-border/40">
                    <Image
                      src={problemImage}
                      alt={problemImageAlt || `Illustration of the AI content risk facing ${industry.toLowerCase()}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 45vw"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {painPoints.map((p, i) => (
                <div key={i} className="card border border-border/60 p-5 rounded-xl">
                  <h3 className="font-semibold text-text-primary mb-2 text-sm">{p.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        {workflow && workflow.length > 0 && (
          <section className="py-16 md:py-20 bg-surface/20 border-t border-border/20">
            <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
              <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-12 text-center">How It Fits Your Workflow</h2>
              <div className="grid sm:grid-cols-3 gap-8 sm:gap-4">
                {workflow.map((step, i) => (
                  <div key={i} className="relative text-center px-2">
                    {i < workflow.length - 1 && <div className="solution-workflow-connector" />}
                    <div className={`relative z-10 w-12 h-12 rounded-full ${c.iconBg} border flex items-center justify-center mx-auto mb-4 font-black ${c.icon}`}>
                      {i + 1}
                    </div>
                    <h3 className="font-semibold text-text-primary text-sm mb-2">{step.title}</h3>
                    <p className="text-xs text-text-muted leading-relaxed max-w-[220px] mx-auto">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

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
                  <div key={i} className="card p-5 rounded-xl border border-border/60 hover:border-primary/20 transition-colors">
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
            <p className="mt-6 text-xs text-text-muted text-center border border-border/30 rounded-lg p-3 max-w-xl mx-auto">
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
                <div key={i} className="relative p-6 rounded-2xl border border-border/60 bg-surface/20">
                  <div className={`text-3xl font-black mb-3 ${c.icon} opacity-30`}>0{i+1}</div>
                  <h3 className="font-semibold text-text-primary mb-3">{uc.title}</h3>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Challenge</p>
                  <p className="text-sm text-text-muted leading-relaxed mb-3">{uc.challenge}</p>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Action</p>
                  <p className="text-sm text-text-muted leading-relaxed mb-4">{uc.action}</p>
                  <div className={`rounded-lg border p-3 text-sm font-semibold ${c.badge}`}>
                    {uc.outcome}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        {comparisonRows && comparisonRows.length > 0 && (
          <section className="py-16 md:py-20 bg-surface/20 border-t border-border/20">
            <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
              <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-10 text-center">
                How Aiscern Compares{comparisonCompetitorName ? ` to ${comparisonCompetitorName}` : ''}
              </h2>
              <div className="overflow-x-auto card border border-border/60 rounded-2xl p-0">
                <table className="solution-comparison-table w-full">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Aiscern</th>
                      <th>{comparisonCompetitorName || 'Alternative'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row, i) => (
                      <tr key={i}>
                        <td className="text-text-secondary">{row.feature}</td>
                        <td className="aiscern-cell">
                          {typeof row.aiscern === 'boolean'
                            ? (row.aiscern ? <Check className={`w-4 h-4 ${c.icon}`} /> : <X className="w-4 h-4 text-text-muted" />)
                            : row.aiscern}
                        </td>
                        <td className="competitor-cell">
                          {typeof row.competitor === 'boolean'
                            ? (row.competitor ? <Check className="w-4 h-4 text-text-muted" /> : <X className="w-4 h-4 text-text-muted" />)
                            : row.competitor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Case Study */}
        {caseStudy && (
          <section className="py-16 md:py-20 bg-surface/30">
            <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
              {caseStudy.isPlaceholder && (
                <div className="flex justify-center mb-4">
                  <span className="solution-placeholder-badge">Placeholder — replace with a real customer</span>
                </div>
              )}
              <div className="flex flex-col md:flex-row items-center gap-8">
                <blockquote className="solution-case-quote flex-1 text-center md:text-left">
                  &ldquo;{caseStudy.quote}&rdquo;
                </blockquote>
                <div className="flex-shrink-0 flex flex-col items-center md:items-start gap-3">
                  <cite className="not-italic text-sm text-center md:text-left">
                    <span className="text-text-primary font-semibold block">{caseStudy.author}</span>
                    <span className="text-text-muted">{caseStudy.role}, {caseStudy.company}</span>
                  </cite>
                  <div className={`rounded-xl border p-3 text-center ${c.badge}`}>
                    <div className="text-2xl font-black">{caseStudy.metric}</div>
                    <div className="text-xs uppercase tracking-wider">{caseStudy.metricLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Legacy testimonial (kept for backward compatibility) */}
        {!caseStudy && testimonialQuote && (
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
            <div className="card border border-border/60 rounded-2xl p-6">
              <FAQ faqs={faqs} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 border-t border-border/20">
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
