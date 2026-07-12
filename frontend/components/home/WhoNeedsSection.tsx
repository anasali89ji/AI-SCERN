'use client'

import Link from 'next/link'
import {
  Newspaper, GraduationCap, Users, Scale, ShieldCheck,
  HeartPulse, Megaphone, Microscope, Pen,
} from 'lucide-react'

const WHO_NEEDS = [
  {
    role: 'Content Creators',
    icon: Pen,
    large: true,
    value: 'Protect your brand from synthetic media. Prove your content is human-authored to platforms and clients — free, in seconds.',
    stat: 'Free',
    statLabel: 'to start',
    href: '/detect/text',
  },
  {
    role: 'Journalists',
    icon: Newspaper,
    value: 'Verify images and audio clips before publication. Catch synthetic sources in seconds.',
    stat: '~98%',
    statLabel: 'image accuracy',
    href: '/detect/image',
  },
  {
    role: 'Educators',
    icon: GraduationCap,
    value: 'Sentence-level heatmaps expose AI-generated essays that other tools miss.',
    stat: '~94%',
    statLabel: 'text accuracy',
    href: '/detect/text',
  },
  {
    role: 'HR Teams',
    icon: Users,
    value: 'Screen CVs and cover letters for AI-polished exaggerations before shortlisting.',
    stat: '<3s',
    statLabel: 'per attestation',
    href: '/detect/text',
  },
  {
    role: 'Legal Professionals',
    icon: Scale,
    value: 'Authenticate contracts, audio recordings, and evidence before court.',
    stat: '~91%',
    statLabel: 'audio accuracy',
    href: '/detect/audio',
  },
  {
    role: 'Security Teams',
    icon: ShieldCheck,
    value: 'Attest deepfake video calls and synthetic identities in incident response.',
    stat: '~88%',
    statLabel: 'video accuracy',
    href: '/detect/video',
  },
  {
    role: 'Researchers',
    icon: Microscope,
    value: 'Validate datasets and academic content at scale with the batch analyser.',
    stat: '20×',
    statLabel: 'batch mode',
    href: '/batch',
  },
  {
    role: 'Marketing Teams',
    icon: Megaphone,
    value: 'Safeguard brand authenticity by screening all incoming creative assets.',
    stat: '6+',
    statLabel: 'content types',
    href: '/detect/image',
  },
  {
    role: 'Healthcare',
    icon: HeartPulse,
    value: 'Verify patient-submitted documents and medical imagery against AI generation.',
    stat: 'API',
    statLabel: 'available',
    href: '/docs/api',
  },
]

export default function WhoNeedsSection() {
  return (
    <section className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-silver-600 mb-3">
            Built For
          </p>
          <h2 className="text-headline text-silver-900 mb-4">
            Who Uses Aiscern
          </h2>
          <p className="text-silver-600 text-base max-w-xl mx-auto leading-relaxed">
            Nine professional verticals. One attestation platform.
          </p>
        </div>

        {/* Bento grid — no carousel, no scroll, everything visible at once */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:auto-rows-[1fr]">
          {WHO_NEEDS.map(card => (
            <Link
              key={card.role}
              href={card.href}
              className={`group flex flex-col p-6 rounded-xl border border-white/[0.06] bg-surface
                          hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-lift
                          transition-all duration-300 focus-visible:ring-2 focus-visible:ring-accent/50
                          ${card.large ? 'lg:row-span-2' : ''}`}
            >
              <card.icon className="w-6 h-6 text-silver-600 mb-4 flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <h3 className="text-base font-semibold text-silver-900 mb-2">{card.role}</h3>
              <p className="text-sm text-silver-600 leading-relaxed flex-1">{card.value}</p>
              <div className="flex items-baseline gap-1.5 pt-4 mt-4 border-t border-white/[0.05]">
                <span className="text-lg font-bold text-silver-900">{card.stat}</span>
                <span className="text-xs text-silver-600">{card.statLabel}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
