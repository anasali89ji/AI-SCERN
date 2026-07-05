'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Newspaper, GraduationCap, Users, Scale, ShieldCheck,
  HeartPulse, Megaphone, Microscope, Pen, ChevronRight,
  ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react'

const WHO_NEEDS = [
  {
    role: 'Journalists',
    icon: Newspaper,
    tag: 'Media',
    color: 'text-[#FFB800]',
    accent: '#f59e0b',
    stat: '~98%',
    statLabel: 'image accuracy',
    value: 'Verify images and audio clips before publication. Catch synthetic sources in seconds.',
    href: '/detect/image',
  },
  {
    role: 'Educators',
    icon: GraduationCap,
    tag: 'Education',
    color: 'text-blue-400',
    accent: '#3b82f6',
    stat: '~94%',
    statLabel: 'text accuracy',
    value: 'Sentence-level heatmaps expose AI-generated essays that other tools miss.',
    href: '/detect/text',
  },
  {
    role: 'HR Teams',
    icon: Users,
    tag: 'Hiring',
    color: 'text-violet-400',
    accent: '#8b5cf6',
    stat: '<3s',
    statLabel: 'per scan',
    value: 'Screen CVs and cover letters for AI-polished prose before shortlisting.',
    href: '/detect/text',
  },
  {
    role: 'Legal Professionals',
    icon: Scale,
    tag: 'Compliance',
    color: 'text-[#2BEE34]',
    accent: '#10b981',
    stat: '~92%',
    statLabel: 'audio accuracy',
    value: 'Authenticate contracts, audio recordings and evidence before court.',
    href: '/detect/audio',
  },
  {
    role: 'Security Teams',
    icon: ShieldCheck,
    tag: 'Cybersecurity',
    color: 'text-sky-400',
    accent: '#0ea5e9',
    stat: '~90%',
    statLabel: 'video accuracy',
    value: 'Detect deepfake video calls and synthetic identities in real time.',
    href: '/detect/video',
  },
  {
    role: 'Researchers',
    icon: Microscope,
    tag: 'Research',
    color: 'text-[#FF4444]',
    accent: '#f43f5e',
    stat: '20×',
    statLabel: 'batch mode',
    value: 'Validate datasets and academic content at scale with the batch analyser.',
    href: '/batch',
  },
  {
    role: 'Content Creators',
    icon: Pen,
    tag: 'Creator',
    color: 'text-orange-400',
    accent: '#fb923c',
    stat: 'Free',
    statLabel: 'to start',
    value: 'Prove your content is human-authored to platforms and clients.',
    href: '/detect/text',
  },
  {
    role: 'Healthcare',
    icon: HeartPulse,
    tag: 'Medical',
    color: 'text-pink-400',
    accent: '#ec4899',
    stat: 'API',
    statLabel: 'available',
    value: 'Verify patient-submitted documents and medical imagery against AI generation.',
    href: '/docs/api',
  },
  {
    role: 'Marketing Teams',
    icon: Megaphone,
    tag: 'Brand',
    color: 'text-teal-400',
    accent: '#14b8a6',
    stat: '6+',
    statLabel: 'content types',
    value: 'Safeguard brand authenticity by screening all incoming creative assets.',
    href: '/detect/image',
  },
]

export default function WhoNeedsSection() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const updateEdges = () => {
    const el = scrollerRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4)
  }

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  return (
    <section className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Built For
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Who Uses Aiscern
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            Nine professional verticals. One detection platform.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-r from-[#141414] to-transparent transition-opacity duration-300"
            style={{ opacity: atStart ? 0 : 1 }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-l from-[#141414] to-transparent transition-opacity duration-300"
            style={{ opacity: atEnd ? 0 : 1 }} />

          <div
            ref={scrollerRef}
            onScroll={updateEdges}
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2
                       [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {WHO_NEEDS.map((card, i) => (
              <motion.div
                key={card.role}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="snap-start shrink-0 w-[280px] sm:w-[300px]"
              >
                <Link
                  href={card.href}
                  className="block h-full p-6 rounded-[14px] border border-white/[0.08]
                             bg-[#0f0f17] hover:border-white/[0.13] hover:-translate-y-0.5
                             transition-all duration-200 group card-lift"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${card.accent}18`, border: `1px solid ${card.accent}28` }}
                    >
                      <card.icon className={`w-5 h-5 ${card.color}`} strokeWidth={1.8} />
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${card.color}`}
                      style={{ background: `${card.accent}12`, border: `1px solid ${card.accent}22` }}
                    >
                      {card.tag}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mb-2">{card.role}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">{card.value}</p>

                  {/* Stat + CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                    <div className="flex-1 min-w-0">
                      <span className={`text-xl font-black ${card.color}`}>{card.stat}</span>
                      <span className="text-xs text-slate-500 ml-1.5">{card.statLabel}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-300 transition-colors flex items-center gap-1 shrink-0">
                      Learn more <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Nav arrows */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => scrollByCard(-1)}
              disabled={atStart}
              aria-label="Previous"
              className="w-9 h-9 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-center
                         text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40 transition-colors
                         disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollByCard(1)}
              disabled={atEnd}
              aria-label="Next"
              className="w-9 h-9 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-center
                         text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40 transition-colors
                         disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
