import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import {
  GraduationCap, Users, Newspaper, Scale, ShieldCheck,
  Heart, Megaphone, Microscope, Pen, ArrowRight, Zap,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Solutions — Aiscern AI Attestation for Every Industry',
  description: 'Aiscern delivers multi-modal AI content attestation tailored for education, HR, journalism, legal, healthcare, security, and more.',
  openGraph: {
    title: 'Industry Solutions — Aiscern',
    description: 'AI attestation built for your industry. Explore solutions for educators, recruiters, journalists, lawyers, and more.',
    url: 'https://aiscern.com/solutions',
    siteName: 'Aiscern',
    images: [{ url: 'https://aiscern.com/og-image.jpg' }],
  },
}

type Solution = {
  href: string
  icon: LucideIcon
  color: 'primary' | 'blue' | 'amber' | 'emerald' | 'rose'
  title: string
  tagline: string
  desc: string
  cta: string
}

const SOLUTIONS: Solution[] = [
  {
    href: '/solutions/education',
    icon: GraduationCap,
    color: 'primary',
    title: 'Education',
    tagline: 'Protect academic integrity',
    desc: 'Attest AI-generated essays, assignments, and research papers. Purpose-built for teachers, professors, and institutions.',
    cta: 'Start Free Teacher Account',
  },
  {
    href: '/solutions/hr',
    icon: Users,
    color: 'blue',
    title: 'Human Resources',
    tagline: 'Hire with confidence',
    desc: 'Verify authenticity of cover letters, CVs, and work samples. Catch AI-written applications before they reach interview stage.',
    cta: 'Start Free HR Account',
  },
  {
    href: '/solutions/media',
    icon: Newspaper,
    color: 'amber',
    title: 'Media & Journalism',
    tagline: 'Defend news integrity',
    desc: 'Identify AI-generated text, synthetic images, and deepfake video in submitted media. Built for fact-checkers and newsrooms.',
    cta: 'Start Free Journalist Account',
  },
  {
    href: '/solutions/legal',
    icon: Scale,
    color: 'emerald',
    title: 'Legal & Compliance',
    tagline: 'Audit AI-generated content',
    desc: 'Verify authorship of legal documents, contracts, and evidence. Maintain chain of custody with forensic-grade attestation reports.',
    cta: 'Start Free Legal Account',
  },
  {
    href: '/solutions/security',
    icon: ShieldCheck,
    color: 'rose',
    title: 'Cybersecurity',
    tagline: 'Stop synthetic threats',
    desc: 'Attest deepfake audio in fraud calls, synthetic identity documents, and AI-crafted phishing content at scale.',
    cta: 'Start Free Security Account',
  },
  {
    href: '/solutions/healthcare',
    icon: Heart,
    color: 'rose',
    title: 'Healthcare',
    tagline: 'Ensure clinical accuracy',
    desc: 'Identify AI-generated medical literature, synthetic patient data, and fabricated imagery in clinical submissions.',
    cta: 'Start Free Healthcare Account',
  },
  {
    href: '/solutions/marketing',
    icon: Megaphone,
    color: 'amber',
    title: 'Marketing & Brand',
    tagline: 'Protect your brand voice',
    desc: 'Audit user-generated content, influencer posts, and agency deliverables for AI generation at scale.',
    cta: 'Start Free Marketing Account',
  },
  {
    href: '/solutions/research',
    icon: Microscope,
    color: 'blue',
    title: 'Academic Research',
    tagline: 'Uphold scientific integrity',
    desc: 'Validate authenticity of papers, datasets, and experiment logs. Integrate with your research workflow via API.',
    cta: 'Start Free Research Account',
  },
  {
    href: '/solutions/content-creators',
    icon: Pen,
    color: 'primary',
    title: 'Content Creators',
    tagline: 'Prove your originality',
    desc: 'Authenticate your own work and attest AI-generated content from contributors, ghostwriters, or UGC submissions.',
    cta: 'Start Free Creator Account',
  },
]

const colorMap: Record<Solution['color'], { bg: string; border: string; text: string }> = {
  primary: { bg: 'bg-accent/10', border: 'border-accent/20', text: 'text-accent' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
}

export default function SolutionsHub() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-surface-deep pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute top-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
          </div>
          <div className="max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs font-semibold text-accent mb-6">
              <Zap className="w-3.5 h-3.5" />
              Industry Solutions
            </div>
            <h1 className="text-headline text-silver-900 mb-5">
              AI Attestation Built<br />
              <span className="text-accent">for Your Industry</span>
            </h1>
            <p className="text-lead text-silver-600 max-w-2xl mx-auto mb-8">
              Every industry faces unique AI content challenges. Aiscern delivers tailored attestation workflows,
              accuracy benchmarks, and reporting tools designed for your specific use case.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/detect/text" className="btn-primary focus-visible:ring-2 focus-visible:ring-accent/50">
                Try Free Attestation <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="btn-secondary focus-visible:ring-2 focus-visible:ring-accent/50">
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Solutions Bento Grid */}
        <section className="py-12 md:py-16 border-t border-white/5">
          <div className="max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {SOLUTIONS.map((sol) => {
                const c = colorMap[sol.color]
                const Icon = sol.icon
                return (
                  <Link key={sol.href} href={sol.href}
                    className="group flex flex-col gap-4 p-6 rounded-xl border border-white/5 bg-surface hover:border-white/10 hover:-translate-y-0.5 hover:shadow-lift transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-accent/50">
                    <Icon className={`w-6 h-6 ${c.text}`} />
                    <div className="flex-1">
                      <div className={`text-xs font-semibold ${c.text} mb-1`}>{sol.tagline}</div>
                      <h2 className="text-lg font-semibold text-silver-900 mb-2">{sol.title}</h2>
                      <p className="text-sm text-silver-600 leading-relaxed">{sol.desc}</p>
                    </div>
                    <div className={`text-xs font-semibold ${c.text} flex items-center gap-1 group-hover:gap-2 transition-all duration-300`}>
                      {sol.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 md:py-20 border-t border-white/5">
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
            <h2 className="text-3xl font-semibold text-silver-900 mb-4">
              Don&apos;t see your industry?
            </h2>
            <p className="text-silver-600 mb-6">
              Aiscern works for any workflow that requires AI content verification. Contact us for a custom solution.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/enterprise" className="btn-primary focus-visible:ring-2 focus-visible:ring-accent/50">
                Talk to Enterprise Sales <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/contact" className="btn-secondary focus-visible:ring-2 focus-visible:ring-accent/50">
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
