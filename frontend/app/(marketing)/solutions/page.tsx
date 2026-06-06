import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import {
  GraduationCap, Users, Globe, Scale,
  ShieldCheck, Heart, Megaphone, Microscope, Pen,
  ArrowRight,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Solutions by Industry | Aiscern',
  description: 'AI content detection for every industry — education, HR, media, legal, security, healthcare, marketing, research, and content creators.',
}

const SOLUTIONS = [
  {
    slug: 'education',
    title: 'Education',
    icon: GraduationCap,
    color: '#2563eb',
    desc: 'Detect AI-generated essays and maintain academic integrity with sentence-level heatmaps.',
    badge: 'Most Popular',
  },
  {
    slug: 'hr',
    title: 'HR & Recruiting',
    icon: Users,
    color: '#0891b2',
    desc: 'Screen AI-polished CVs and cover letters before candidates reach the interview stage.',
    badge: null,
  },
  {
    slug: 'media',
    title: 'Media & Journalism',
    icon: Globe,
    color: '#7c3aed',
    desc: 'Verify images, audio clips and sources before they publish — in under 10 seconds.',
    badge: null,
  },
  {
    slug: 'legal',
    title: 'Legal & Compliance',
    icon: Scale,
    color: '#059669',
    desc: 'Authenticate documents, evidence and contracts with a shareable detection report.',
    badge: null,
  },
  {
    slug: 'security',
    title: 'Security & Fraud',
    icon: ShieldCheck,
    color: '#dc2626',
    desc: 'Detect voice clones, deepfake videos, and synthetic identities at scale.',
    badge: null,
  },
  {
    slug: 'healthcare',
    title: 'Healthcare',
    icon: Heart,
    color: '#db2777',
    desc: 'Verify medical research authenticity and protect against AI-hallucinated citations.',
    badge: null,
  },
  {
    slug: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    color: '#d97706',
    desc: 'Audit UGC campaigns and brand content for undisclosed AI generation.',
    badge: null,
  },
  {
    slug: 'research',
    title: 'Research & Academia',
    icon: Microscope,
    color: '#0891b2',
    desc: 'Check paper authenticity and validate citations before submission.',
    badge: null,
  },
  {
    slug: 'creators',
    title: 'Content Creators',
    icon: Pen,
    color: '#7c3aed',
    desc: 'Prove your content is human-made with shareable authenticity certificates.',
    badge: null,
  },
]

export default function SolutionsHubPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <SiteNav />

      {/* Hero */}
      <section className="pt-32 pb-16 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
            Industry Solutions
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display text-white mb-4 leading-tight">
            AI Detection for Every Industry
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            Aiscern&apos;s multi-modal detection works across text, image, audio, and video — built for the specific workflows of each profession.
          </p>
        </div>
      </section>

      {/* Solutions grid */}
      <section className="pb-24 px-4">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOLUTIONS.map(s => {
            const Icon = s.icon
            return (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="group relative card p-6 rounded-2xl border border-border/60 bg-surface hover:border-primary/30 transition-all duration-200 hover:-translate-y-1"
              >
                {s.badge && (
                  <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25">
                    {s.badge}
                  </div>
                )}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <h2 className="text-base font-semibold text-white mb-2">{s.title}</h2>
                <p className="text-sm text-text-muted leading-relaxed mb-4">{s.desc}</p>
                <div className="flex items-center gap-1 text-xs font-medium" style={{ color: s.color }}>
                  Learn more <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
