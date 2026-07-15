import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import {
  GraduationCap, Users, Newspaper, Scale, ShieldCheck,
  Heart, Megaphone, Microscope, Pen, ArrowRight, Zap, Check,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Solutions — Aiscern AI Detection for Every Industry',
  description: 'Aiscern delivers multi-modal AI content detection tailored for education, HR, journalism, legal, healthcare, security, and more.',
  openGraph: {
    title: 'Industry Solutions — Aiscern',
    description: 'AI detection built for your industry. Explore solutions for educators, recruiters, journalists, lawyers, and more.',
    url: 'https://aiscern.com/solutions',
    siteName: 'Aiscern',
    images: [{ url: 'https://aiscern.com/og-image.jpg' }],
  },
}

const SOLUTIONS = [
  {
    href: '/solutions/education',
    thumb: '/solutions/education/hero.webp',
    icon: GraduationCap,
    color: 'primary',
    title: 'Education',
    tagline: 'Protect academic integrity',
    desc: 'Detect AI-generated essays, assignments, and research papers. Purpose-built for teachers, professors, and institutions.',
    cta: 'Start Free Teacher Account',
  },
  {
    href: '/solutions/hr',
    thumb: '/solutions/hr/hero.webp',
    icon: Users,
    color: 'cyan',
    title: 'Human Resources',
    tagline: 'Hire with confidence',
    desc: 'Verify authenticity of cover letters, CVs, and work samples. Catch AI-written applications before they reach interview stage.',
    cta: 'Start Free HR Account',
  },
  {
    href: '/solutions/media',
    thumb: '/solutions/media/hero.webp',
    icon: Newspaper,
    color: 'amber',
    title: 'Media & Journalism',
    tagline: 'Defend news integrity',
    desc: 'Identify AI-generated text, synthetic images, and deepfake video in submitted media. Built for fact-checkers and newsrooms.',
    cta: 'Start Free Journalist Account',
  },
  {
    href: '/solutions/legal',
    thumb: '/solutions/legal/hero.webp',
    icon: Scale,
    color: 'emerald',
    title: 'Legal & Compliance',
    tagline: 'Audit AI-generated content',
    desc: 'Verify authorship of legal documents, contracts, and evidence. Maintain chain of custody with forensic-grade detection reports.',
    cta: 'Start Free Legal Account',
  },
  {
    href: '/solutions/security',
    thumb: '/solutions/security/hero.webp',
    icon: ShieldCheck,
    color: 'rose',
    title: 'Cybersecurity',
    tagline: 'Stop synthetic threats',
    desc: 'Detect deepfake audio in fraud calls, synthetic identity documents, and AI-crafted phishing content at scale.',
    cta: 'Start Free Security Account',
  },
  {
    href: '/solutions/healthcare',
    thumb: '/solutions/healthcare/hero.webp',
    icon: Heart,
    color: 'rose',
    title: 'Healthcare',
    tagline: 'Ensure clinical accuracy',
    desc: 'Identify AI-generated medical literature, synthetic patient data, and fabricated imagery in clinical submissions.',
    cta: 'Start Free Healthcare Account',
  },
  {
    href: '/solutions/marketing',
    thumb: '/solutions/marketing/hero.webp',
    icon: Megaphone,
    color: 'amber',
    title: 'Marketing & Brand',
    tagline: 'Protect your brand voice',
    desc: 'Audit user-generated content, influencer posts, and agency deliverables for AI generation at scale.',
    cta: 'Start Free Marketing Account',
  },
  {
    href: '/solutions/research',
    thumb: '/solutions/research/hero.webp',
    icon: Microscope,
    color: 'cyan',
    title: 'Academic Research',
    tagline: 'Uphold scientific integrity',
    desc: 'Validate authenticity of papers, datasets, and experiment logs. Integrate with your research workflow via API.',
    cta: 'Start Free Research Account',
  },
  {
    href: '/solutions/content-creators',
    thumb: '/solutions/content-creators/hero.webp',
    icon: Pen,
    color: 'primary',
    title: 'Content Creators',
    tagline: 'Prove your originality',
    desc: 'Authenticate your own work and detect AI-generated content from contributors, ghostwriters, or UGC submissions.',
    cta: 'Start Free Creator Account',
  },
]

const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  primary: { bg: 'bg-primary/8', border: 'border-primary/25', text: 'text-primary', icon: 'text-primary' },
  cyan:    { bg: 'bg-cyan/8',    border: 'border-cyan/25',    text: 'text-cyan',    icon: 'text-cyan'    },
  amber:   { bg: 'bg-amber/8',   border: 'border-amber/25',   text: 'text-amber',   icon: 'text-amber'   },
  emerald: { bg: 'bg-emerald/8', border: 'border-emerald/25', text: 'text-emerald', icon: 'text-emerald' },
  rose:    { bg: 'bg-rose/8',    border: 'border-rose/25',    text: 'text-rose',    icon: 'text-rose'    },
}

export default function SolutionsHub() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-background pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
          </div>
          <div className="max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-6">
              <Zap className="w-3.5 h-3.5" />
              Industry Solutions
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-text-primary mb-5 leading-tight">
              AI Detection Built<br />
              <span className="gradient-text">for Your Industry</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
              Every industry faces unique AI content challenges. Aiscern delivers tailored detection workflows,
              accuracy benchmarks, and reporting tools designed for your specific use case.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/detect/text" className="btn-primary">
                Try Free Detection <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="btn-secondary">
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Solutions Grid */}
        <section className="py-12 md:py-16">
          <div className="max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {SOLUTIONS.map((sol) => {
                const c = colorMap[sol.color]
                const Icon = sol.icon
                return (
                  <Link key={sol.href} href={sol.href}
                    className="group card card-hover flex flex-col gap-4 p-6 rounded-2xl border border-border hover:border-primary/30 transition-all duration-300">
                    <div className="relative w-full aspect-[5/3] rounded-xl overflow-hidden border border-border/40">
                      <Image
                        src={sol.thumb}
                        alt={`${sol.title} solution preview`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                    <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${c.icon}`} />
                    </div>
                    <div className="flex-1">
                      <div className={`text-xs font-semibold ${c.text} mb-1`}>{sol.tagline}</div>
                      <h2 className="text-lg font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">{sol.title}</h2>
                      <p className="text-sm text-text-muted leading-relaxed">{sol.desc}</p>
                    </div>
                    <div className={`text-xs font-semibold ${c.text} flex items-center gap-1 group-hover:gap-2 transition-all`}>
                      {sol.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Comparison Strip */}
        <section className="py-12 border-t border-border/20 bg-surface/20">
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-xl md:text-2xl font-black text-text-primary mb-8 text-center">
              Aiscern vs. Single-Model Detectors
            </h2>
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="card border border-border/60 p-5 rounded-xl text-center">
                <div className="text-2xl font-black text-primary mb-1">8+ models</div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Ensemble size</p>
                <p className="text-sm text-text-muted">Single-model tools rely on one classifier. Aiscern combines multiple detection approaches per modality.</p>
              </div>
              <div className="card border border-border/60 p-5 rounded-xl text-center">
                <div className="text-2xl font-black text-primary mb-1">4 modalities</div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Text, image, audio, video</p>
                <p className="text-sm text-text-muted">Most competitors specialize in one modality. Aiscern covers all four from a single account.</p>
              </div>
              <div className="card border border-border/60 p-5 rounded-xl text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Check className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-black text-primary">Uncertainty zone</span>
                </div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Confidence transparency</p>
                <p className="text-sm text-text-muted">Instead of a binary verdict, Aiscern reports a middle confidence range so you know when to apply human judgment.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 md:py-20">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-text-primary mb-4">
              Don&apos;t see your industry?
            </h2>
            <p className="text-text-secondary mb-6">
              Aiscern works for any workflow that requires AI content verification. Contact us for a custom solution.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/enterprise" className="btn-primary">
                Talk to Enterprise Sales <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/contact" className="btn-secondary">
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
