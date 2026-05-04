'use client'
/**
 * WhoNeedsSection — lazy-loaded chunk
 * Extracted from app/page.tsx for route-based code splitting.
 * Loaded via next/dynamic only when this section enters the viewport.
 */
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Globe, Award, Users, Shield, Lock, Sparkles,
  TrendingUp, Activity, Brain, AlertTriangle,
  CheckCircle, Eye, ChevronRight,
} from 'lucide-react'

// ─── Data ──────────────────────────────────────────────────────────────────
const WHO_NEEDS = [
  {
    role: 'Journalists & Fact-Checkers',
    icon: Globe,
    img: '/trust/journalists.jpg',
    tag: 'Media & Press',
    problem: 'AI-fabricated quotes, deepfake press photos and synthetic sources arriving faster than ever.',
    value: 'Verify every image, audio clip and statement before it publishes — in under 10 seconds.',
    stats: [{ label: 'Image verification', value: '~82%' }, { label: 'Audio deepfake', value: '~79%' }],
    href: '/detect/image',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.22)',
  },
  {
    role: 'Educators & Schools',
    icon: Award,
    img: '/trust/educators.jpg',
    tag: 'Education',
    problem: 'Students submitting ChatGPT essays — academic integrity eroding class by class.',
    value: 'Sentence-level AI heatmaps and confidence scores catch generated text other tools miss.',
    stats: [{ label: 'Text detection', value: '~85%' }, { label: 'Avg scan time', value: '<3s' }],
    href: '/detect/text',
    color: '#2563eb',
    glow: 'rgba(37,99,235,0.22)',
  },
  {
    role: 'HR & Recruiters',
    icon: Users,
    img: '/trust/hr.jpg',
    tag: 'Talent & Hiring',
    problem: 'AI-polished CVs and cover letters that mask the real candidate behind perfect prose.',
    value: 'Screen written applications and video-interview transcripts for synthetic content before hiring.',
    stats: [{ label: 'CV text scan', value: '~85%' }, { label: 'Video analysis', value: '~76%' }],
    href: '/detect/text',
    color: '#0891b2',
    glow: 'rgba(8,145,178,0.22)',
  },
  {
    role: 'Legal Professionals',
    icon: Shield,
    img: '/trust/legal.jpg',
    tag: 'Law & Compliance',
    problem: 'Deepfake evidence, AI-drafted contracts and forged audio recordings entering proceedings.',
    value: 'Detection reports for documents, images and audio — shareable with one link. Results are probabilistic; use alongside human judgment.',
    stats: [{ label: 'Audio detection', value: '~79%' }, { label: 'Image analysis', value: '~82%' }],
    href: '/detect/audio',
    color: '#059669',
    glow: 'rgba(5,150,105,0.22)',
  },
  {
    role: 'Security & Trust & Safety',
    icon: Lock,
    img: '/trust/security.jpg',
    tag: 'Cybersecurity',
    problem: 'Voice-cloned fraud calls, synthetic ID photos and AI-generated phishing content at scale.',
    value: 'Batch-scan hundreds of files simultaneously — text, image, audio and video in one queue.',
    stats: [{ label: 'Batch capacity', value: '20×' }, { label: 'Voice clone det.', value: '~79%' }],
    href: '/batch',
    color: '#dc2626',
    glow: 'rgba(220,38,38,0.22)',
  },
  {
    role: 'Content Creators',
    icon: Sparkles,
    img: '/trust/creators.jpg',
    tag: 'Creative Work',
    problem: 'Clients doubting originality while competitors flood feeds with AI-generated content.',
    value: 'Authenticate your work with a shareable proof-of-authenticity link — instantly and free.',
    stats: [{ label: 'Multi-modal', value: '4 types' }, { label: 'Shareable report', value: '1-click' }],
    href: '/detect/image',
    color: '#d97706',
    glow: 'rgba(217,119,6,0.22)',
  },
  {
    role: 'Academic Researchers',
    icon: Brain,
    img: '/trust/researchers.jpg',
    tag: 'Research & Science',
    problem: 'AI-generated papers, hallucinated citations and synthetic datasets corrupting research.',
    value: 'Validate source material and peer submissions using methodology-backed multi-model detection.',
    stats: [{ label: 'Text accuracy', value: '~85%' }, { label: 'Datasets used', value: '87' }],
    href: '/methodology',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.22)',
  },
  {
    role: 'Marketing & Brand Teams',
    icon: TrendingUp,
    img: '/trust/marketing.jpg',
    tag: 'Brand Safety',
    problem: 'UGC campaigns flooded with AI images, fake reviews and synthetic testimonials harming trust.',
    value: 'Audit every piece of user-generated content before it goes live — protect brand credibility.',
    stats: [{ label: 'Image detection', value: '~82%' }, { label: 'Batch UGC scan', value: '20×' }],
    href: '/detect/image',
    color: '#2563eb',
    glow: 'rgba(37,99,235,0.22)',
  },
  {
    role: 'Healthcare Professionals',
    icon: Activity,
    img: '/trust/healthcare.jpg',
    tag: 'Medicine & Health',
    problem: 'AI-fabricated medical reports, synthetic scans and health misinformation spreading fast.',
    value: 'Verify medical documents, imagery and audio records across all four modalities — free.',
    stats: [{ label: 'Multi-modal', value: '4 types' }, { label: 'Confidence score', value: 'Full' }],
    href: '/detect/image',
    color: '#059669',
    glow: 'rgba(5,150,105,0.22)',
  },
]

// ─── Card ──────────────────────────────────────────────────────────────────
function WhoNeedsCard({ card, i }: { card: typeof WHO_NEEDS[0]; i: number }) {
  const CardIcon = card.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: i * 0.04, duration: 0.5, ease: 'easeOut' }}
      className="group relative flex flex-col rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.10] transition-all duration-500 hover:-translate-y-1.5"
      style={{ boxShadow: `0 0 0 1px ${card.color}18, 0 2px 12px rgba(0,0,0,0.3)` }}
    >
      {/* ── Image panel ── */}
      <div className="relative h-36 sm:h-40 overflow-hidden flex-shrink-0">
        <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${card.color}60, ${card.color}25)` }} />
        <Image
          src={card.img} alt={card.role} fill
          className="object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          quality={72}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="absolute inset-0" style={{ background: `${card.color}28` }} />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${card.color}, transparent)` }} />
        <div className="absolute top-2.5 left-3 z-10">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${card.color}70`, color: '#fff' }}
          >
            <CardIcon className="w-2.5 h-2.5" />
            {card.tag}
          </span>
        </div>
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(ellipse at 50% 120%, ${card.glow} 0%, transparent 65%)` }}
        />
        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3 z-10">
          <h3 className="text-[13px] sm:text-sm font-black text-white leading-snug drop-shadow-lg">{card.role}</h3>
        </div>
      </div>

      {/* ── Content panel ── */}
      <div className="bg-surface/96 backdrop-blur-sm flex flex-col flex-1 p-3.5 sm:p-4 gap-3">
        {/* Problem */}
        <div className="flex gap-2.5 items-start">
          <div className="w-5 h-5 rounded-lg bg-rose/12 border border-rose/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-2.5 h-2.5 text-rose" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-rose/60 uppercase tracking-widest mb-0.5">The Problem</p>
            <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{card.problem}</p>
          </div>
        </div>
        {/* Separator */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border/50" />
          <div className="w-1 h-1 rounded-full" style={{ background: card.color }} />
          <div className="flex-1 h-px bg-border/50" />
        </div>
        {/* Solution */}
        <div className="flex gap-2.5 items-start">
          <div className="w-5 h-5 rounded-lg bg-emerald/12 border border-emerald/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle className="w-2.5 h-2.5 text-emerald" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-emerald/60 uppercase tracking-widest mb-0.5">Aiscern Solves It</p>
            <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{card.value}</p>
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-1.5 flex-wrap min-w-0">
          {card.stats.map(s => (
            <span key={s.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black"
              style={{ background: `${card.color}12`, border: `1px solid ${card.color}25`, color: card.color }}>
              <span className="font-black">{s.value}</span>
              <span className="font-medium opacity-70">· {s.label}</span>
            </span>
          ))}
        </div>
        {/* CTA */}
        <Link
          href={card.href}
          aria-label={`Start free AI detection for ${card.role}`}
          className="mt-auto flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 group/btn hover:brightness-110"
          style={{ background: `${card.color}14`, border: `1px solid ${card.color}30`, color: card.color }}
        >
          <span className="font-black">Try free</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Section (default export) ──────────────────────────────────────────────
export default function WhoNeedsSection() {
  return (
    <section className="relative py-16 sm:py-24 lg:py-32 px-5 sm:px-8 lg:px-12 bg-background border-b border-border/20 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full bg-primary/4 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-secondary/4 blur-[100px]" />
      </div>
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-[11px] sm:text-xs font-black uppercase tracking-widest mb-5">
            <Users className="w-3 h-3" />
            Who Uses Aiscern
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight">
            Used by Professionals <span className="gradient-text">Across Industries</span>
          </h2>
          <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            <strong className="text-text-secondary">AI-generated content</strong> is a problem in every field.
            Aiscern gives professionals detection tools to identify it —{' '}
            <strong className="text-primary">free tier available</strong>, across all four modalities.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {['Media', 'Education', 'Legal', 'HR', 'Security', 'Research', 'Healthcare', 'Marketing'].map(tag => (
              <span key={tag} className="text-[10px] sm:text-xs font-semibold text-text-muted px-2.5 py-1 rounded-full border border-border/50 hover:border-primary/30 hover:text-primary transition-all duration-200 cursor-default">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
          {WHO_NEEDS.map((card, i) => (
            <WhoNeedsCard key={card.role} card={card} i={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Link href="/detect/text"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] transition-all duration-200">
            <Brain className="w-4 h-4" />
            Start Free Scan
          </Link>
          <Link href="/methodology"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border/50 text-sm font-semibold text-text-muted hover:border-primary/40 hover:text-text-primary transition-all duration-200">
            <Eye className="w-4 h-4" />
            See How It Works
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
