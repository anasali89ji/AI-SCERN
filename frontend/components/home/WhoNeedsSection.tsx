'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Newspaper, GraduationCap, Users, Scale, ShieldCheck,
  HeartPulse, Megaphone, Microscope, Pen, ChevronRight,
} from 'lucide-react'

const WHO_NEEDS = [
  {
    role: 'Journalists',
    icon: Newspaper,
    tag: 'Media',
    color: 'text-amber-400-400',
    accent: '#f59e0b',
    stat: '~82%',
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
    stat: '~85%',
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
    color: 'text-emerald-400-400',
    accent: '#10b981',
    stat: '~79%',
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
    stat: '~76%',
    statLabel: 'video accuracy',
    value: 'Detect deepfake video calls and synthetic identities in real time.',
    href: '/detect/video',
  },
  {
    role: 'Researchers',
    icon: Microscope,
    tag: 'Research',
    color: 'text-rose-400-400',
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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22,1,0.36,1] } },
}

export default function WhoNeedsSection() {
  return (
    <section className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 sm:mb-18"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Built For
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Who Uses Aiscern
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            Nine professional verticals. One detection platform.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {WHO_NEEDS.map((card) => (
            <motion.div key={card.role} variants={item}>
              <Link href={card.href}
                className="block h-full p-6 rounded-[14px] border border-white/[0.08]
                           bg-[#0f0f17] hover:border-white/[0.13] hover:-translate-y-px
                           transition-all duration-200 group"
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
                  <div>
                    <span className={`text-xl font-black ${card.color}`}>{card.stat}</span>
                    <span className="text-xs text-slate-500 ml-1.5">{card.statLabel}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-600 group-hover:text-slate-300 transition-colors flex items-center gap-1">
                    Learn more <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
