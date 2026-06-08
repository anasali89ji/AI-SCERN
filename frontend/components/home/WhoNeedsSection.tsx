'use client'
import Link from 'next/link'
import {
  Newspaper, GraduationCap, Users, Scale, Shield,
  Video, Microscope, TrendingUp, HeartPulse,
  CheckCircle, ChevronRight, Brain, Eye,
} from 'lucide-react'

const WHO_NEEDS = [
  {
    role: 'Journalists & Fact-Checkers',
    icon: Newspaper,
    tag: 'Media & Press',
    problem: 'AI-fabricated quotes, deepfake press photos and synthetic sources arriving faster than ever.',
    value: 'Verify every image, audio clip and statement before it publishes — in under 10 seconds.',
    stats: [{ label: 'Image', value: '~82%' }, { label: 'Audio', value: '~79%' }],
    href: '/detect/image',
  },
  {
    role: 'Educators & Schools',
    icon: GraduationCap,
    tag: 'Education',
    problem: 'Students submitting ChatGPT essays — academic integrity eroding class by class.',
    value: 'Sentence-level AI heatmaps and confidence scores catch generated text other tools miss.',
    stats: [{ label: 'Text', value: '~85%' }, { label: 'Scan time', value: '<3s' }],
    href: '/detect/text',
  },
  {
    role: 'HR & Recruiters',
    icon: Users,
    tag: 'Talent & Hiring',
    problem: 'AI-polished CVs and cover letters that mask the real candidate behind perfect prose.',
    value: 'Screen written applications and video-interview transcripts for synthetic content before hiring.',
    stats: [{ label: 'Text', value: '~85%' }, { label: 'Video', value: '~76%' }],
    href: '/detect/text',
  },
  {
    role: 'Legal Professionals',
    icon: Scale,
    tag: 'Law & Compliance',
    problem: 'Deepfake evidence, AI-drafted contracts and forged audio recordings entering proceedings.',
    value: 'Detection reports for documents, images and audio — shareable with one link.',
    stats: [{ label: 'Audio', value: '~79%' }, { label: 'Image', value: '~82%' }],
    href: '/detect/audio',
  },
  {
    role: 'Security & Trust & Safety',
    icon: Shield,
    tag: 'Cybersecurity',
    problem: 'Voice-cloned fraud calls, synthetic ID photos and AI-generated phishing content at scale.',
    value: 'Batch-scan hundreds of files simultaneously — text, image, audio and video in one queue.',
    stats: [{ label: 'Batch', value: '20×' }, { label: 'Voice', value: '~79%' }],
    href: '/batch',
  },
  {
    role: 'Content Creators',
    icon: Video,
    tag: 'Creative Work',
    problem: 'Clients doubting originality while competitors flood feeds with AI-generated content.',
    value: 'Authenticate your work with a shareable proof-of-authenticity link — instantly and free.',
    stats: [{ label: 'Modalities', value: '4 types' }, { label: 'Reports', value: '1-click' }],
    href: '/detect/image',
  },
  {
    role: 'Academic Researchers',
    icon: Microscope,
    tag: 'Research & Science',
    problem: 'AI-generated papers, hallucinated citations and synthetic datasets corrupting research.',
    value: 'Validate source material and peer submissions using methodology-backed multi-model detection.',
    stats: [{ label: 'Text', value: '~85%' }, { label: 'Datasets', value: '87' }],
    href: '/methodology',
  },
  {
    role: 'Marketing & Brand Teams',
    icon: TrendingUp,
    tag: 'Brand Safety',
    problem: 'UGC campaigns flooded with AI images, fake reviews and synthetic testimonials harming trust.',
    value: 'Audit every piece of user-generated content before it goes live — protect brand credibility.',
    stats: [{ label: 'Image', value: '~82%' }, { label: 'Batch', value: '20×' }],
    href: '/detect/image',
  },
  {
    role: 'Healthcare Professionals',
    icon: HeartPulse,
    tag: 'Medicine & Health',
    problem: 'AI-fabricated medical reports, synthetic scans and health misinformation spreading fast.',
    value: 'Verify medical documents, imagery and audio records across all four modalities — free.',
    stats: [{ label: 'Modalities', value: '4 types' }, { label: 'Confidence', value: 'Full' }],
    href: '/detect/image',
  },
]

function WhoNeedsCard({ card }: { card: typeof WHO_NEEDS[0] }) {
  const CardIcon = card.icon
  return (
    <div className="group rounded-xl border border-white/[0.08] bg-[#0f0f17] p-6 hover:border-blue-500/30 hover:bg-[#141420] hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
          <CardIcon className="w-5 h-5 text-blue-400" strokeWidth={1.8} />
        </div>
        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 uppercase tracking-wider">
          {card.tag}
        </span>
      </div>

      <h3 className="text-base font-semibold text-white mb-3 leading-snug">{card.role}</h3>

      <p className="text-xs text-slate-500 leading-relaxed mb-3">{card.problem}</p>

      <p className="text-xs text-slate-400 leading-relaxed mb-4 flex-1">{card.value}</p>

      <div className="flex gap-2 flex-wrap mb-4">
        {card.stats.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-400 font-medium">{s.value}</span>
            <span className="text-slate-500">{s.label}</span>
          </span>
        ))}
      </div>

      <Link
        href={card.href}
        className="mt-auto flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors duration-200"
      >
        <span>Try free</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  )
}

export default function WhoNeedsSection() {
  return (
    <section className="relative py-16 sm:py-24 lg:py-32 px-4 sm:px-6 bg-[#08080d] border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">Who Uses Aiscern</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-4 leading-tight">
            Used by Professionals Across Industries
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            AI-generated content is a problem in every field. Aiscern gives professionals detection tools to identify it — free tier available, across all four modalities.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {WHO_NEEDS.map((card) => (
            <WhoNeedsCard key={card.role} card={card} />
          ))}
        </div>

        <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/detect/text"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors duration-200">
            <Brain className="w-4 h-4" />
            Start Free Scan
          </Link>
          <Link href="/methodology"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/[0.08] hover:border-white/[0.12] text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200">
            <Eye className="w-4 h-4" />
            See How It Works
          </Link>
        </div>
      </div>
    </section>
  )
}
