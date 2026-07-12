'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Shield, FileText, Zap,
  ArrowRight, CheckCircle2,
  Image as ImageIcon, Video, Music,
  Layers, Scan, Activity, Wand2,
  MessageSquare, Database, TrendingUp, Users,
  FlaskConical,
  GraduationCap, Scale, ShieldCheck, Microscope, Pen, Megaphone, Heart,
  ScanLine, BarChart3,
} from 'lucide-react'

import HomepageReviews from '@/components/home/HomepageReviews'
import { WhoNeedsCarousel } from '@/components/home/WhoNeedsCarousel'
import WhoNeedsSection from '@/components/home/WhoNeedsSection'
import AIvsRealSection from '@/components/home/AIvsRealSection'
import { HeroHeadline } from '@/components/hero/HeroHeadline'
import { MagneticButton } from '@/components/MagneticButton'
import { LiveDemo } from '@/components/home/LiveDemo'
import { StatsRibbon } from '@/components/home/StatsRibbon'

// ─── CountUp ──────────────────────────────────────────────────────────────────
// NOTE: kept here — still used by the Trust Features section below (out of
// Module 2's scope, which only covers Hero/LiveDemo/StatsRibbon). Not migrated
// to StatsRibbon's rAF-based CountUpValue in this pass to avoid touching a
// section not part of this module.
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount]       = useState(0)
  const [animated, setAnimated] = useState(false)
  const ref                     = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (animated) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated) return
      setAnimated(true)
      let start  = 0
      const steps = 60
      const step  = target / steps
      const id    = setInterval(() => {
        start += step
        if (start >= target) { setCount(target); clearInterval(id) }
        else setCount(Math.floor(start))
      }, 1400 / steps)
    }, { threshold: 0.2 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, animated])

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>
}

// ─── Constants ────────────────────────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

const TOOLS = [
  { href: '/detect/text',  icon: FileText,      label: 'Text Attestation',           desc: 'ChatGPT, Claude, Gemini & more',            accuracy: '~94%', accent: '#f59e0b', glow: 'text'  },
  { href: '/detect/image', icon: ImageIcon,     label: 'Image Attestation',    desc: 'Midjourney, DALL-E, Stable Diffusion',      accuracy: '~98%', accent: '#2563eb', glow: 'image' },
  { href: '/detect/audio', icon: Music,         label: 'Audio Attestation',  desc: 'ElevenLabs, voice cloning, TTS synthesis',  accuracy: '~91%', accent: '#06b6d4', glow: 'audio' },
  { href: '/detect/video', icon: Video,         label: 'Video Attestation',    desc: 'Frame-by-frame deepfake analysis',           accuracy: '~88%', accent: '#8b5cf6', glow: 'video' },
  { href: '/chat',         icon: MessageSquare, label: 'ARIA Attestation Assistant',   desc: 'Ask anything about AI detection',            accuracy: 'New',  accent: '#2BEE34', glow: 'text'  },
  { href: '/batch',        icon: Database,      label: 'Bulk Attestation',     desc: 'Analyze 20 files simultaneously',            accuracy: '20×',  accent: '#f43f5e', glow: 'video' },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Submit or Paste',   desc: 'Drop any image, video, audio file or paste text / a URL — any format, any size.' },
  { n: '02', title: 'Forensic Examination', desc: 'Multi-model AI analyzes 20+ detection signals across all content types in parallel.' },
  { n: '03', title: 'Review Findings',   desc: 'Integrity rating, signal breakdown, and sentence-level heatmap in under 3 seconds.' },
  { n: '04', title: 'Export & Share',    desc: 'Save your evidence locker, share findings by link, or export full PDF case files.' },
]

const TRUST_FEATURES = [
  { icon: Database,    title: 'Benchmarked Datasets',  desc: 'Models evaluated against curated public datasets spanning AI-generated and authentic content.', wide: true,  stat: '2.2M+', statLabel: 'training samples', accent: '#2563eb' },
  { icon: Shield,      title: 'Research-Backed',        desc: 'Built on peer-reviewed detection research. Every signal validated against real-world AI outputs.', wide: false, stat: '8+',    statLabel: 'papers cited', accent: '#10b981' },
  { icon: TrendingUp,  title: 'Ensemble Models',        desc: 'Multi-model consensus — no single model makes the final call. RoBERTa, ViT, and wav2vec2.',     wide: false, stat: '20+',   statLabel: 'signals analyzed', accent: '#f59e0b' },
  { icon: Zap,         title: 'Free Tier Available',    desc: 'Start attesting for free — no credit card required. Upgrade when you need more scans.',           wide: false, stat: 'Free',  statLabel: 'to start', accent: '#06b6d4' },
]

const PROFESSIONALS = [
  { label: 'Journalists',      icon: Pen           },
  { label: 'Educators',        icon: GraduationCap },
  { label: 'HR Teams',         icon: Users         },
  { label: 'Legal Pros',       icon: Scale         },
  { label: 'Security Teams',   icon: ShieldCheck   },
  { label: 'Researchers',      icon: Microscope    },
  { label: 'Content Creators', icon: Megaphone     },
  { label: 'Marketing Teams',  icon: TrendingUp    },
  { label: 'Healthcare',       icon: Heart         },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5] overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([
          { "@context":"https://schema.org","@type":"WebApplication","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble AI content detection for text, images, audio, and video.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"} },
          { "@context":"https://schema.org","@type":"Organization","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png" },
          { "@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses a 14-layer ensemble combining ViT classifiers, RoBERTa, wav2vec2, and physics-based signal analysis (Bayer demosaicing, polarization, subsurface scattering, sensor QE matching). Benchmarked accuracy: text ~94% (F1 0.965, AUC 0.98), image ~98% (AUC 0.98, 14 layers), audio ~91% (AUC 0.95), video ~88% (AUC 0.93). See /benchmarks for full results."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free tier with 10 scans per day on text and image detection. No credit card required. Pro plans available for audio, video, and higher limits."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion, SDXL, FLUX, Gemini, and Grok images using a 14-layer ensemble including physics-based Bayer pattern analysis (L12-BDIS) with 100% recall across all major generators."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a REST API available on Team and Enterprise plans. See aiscern.com/docs/api."}}]},
        ]) }}
      />

      <SiteNav />

      <main id="main-content">

        {/* ══ HERO ══ */}
        <section className="relative min-h-[100svh] flex items-center overflow-hidden pt-16 pb-16 sm:pb-20 bg-depth-bg">
          {/* Base gradient backdrop */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-surface via-depth-bg to-surface" />
          {/* Single ambient orb, top-right — no particle fields, no mesh gradients */}
          <div className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full bg-moss-300/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 px-4 sm:px-6 max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-[55%_45%] gap-10 lg:gap-16 items-center">

              {/* Left: Headline + CTAs */}
              <div className="text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                                border border-accent/20 bg-accent/5 text-accent
                                text-xs font-semibold mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Ensemble of 8+ forensic engines · Text, Image, Audio, Video</span>
                  <span className="sm:hidden">8+ models · Free tier available</span>
                </div>

                {/* Headline — static typography, no rotating word animation (Module 2.1) */}
                <div className="mb-6 flex flex-col items-center lg:items-start animate-enter">
                  <HeroHeadline />
                </div>

                {/* Subheadline */}
                <p className="text-lead text-silver-600 max-w-[48ch] mx-auto lg:mx-0 mb-10 animate-enter">
                  Ensemble-based detection for text, images, audio, and video.
                  Built with published accuracy benchmarks — no black box.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5 animate-enter">
                  {user ? (
                    <>
                      <Link href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-accent hover:bg-accent-hover text-depth-bg font-semibold
                                   text-base transition-colors duration-200 w-full sm:w-auto
                                   focus-visible:ring-2 focus-visible:ring-accent/50">
                        Dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <Link href="/chat"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-surface-elevated border border-white/[0.08] hover:border-accent hover:text-accent
                                   text-silver-800 font-semibold text-base transition-all duration-200 w-full sm:w-auto
                                   focus-visible:ring-2 focus-visible:ring-accent/50">
                        <MessageSquare className="w-4 h-4" aria-hidden="true" /> ARIA Assistant
                      </Link>
                    </>
                  ) : (
                    <>
                      <MagneticButton className="w-full sm:w-auto">
                        <Link href="/detect/text"
                          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                     bg-accent hover:bg-accent-hover text-depth-bg font-semibold
                                     text-base transition-colors duration-200 w-full sm:w-auto
                                     focus-visible:ring-2 focus-visible:ring-accent/50">
                          <ScanLine className="w-4 h-4" aria-hidden="true" /> Start Free Attestation
                        </Link>
                      </MagneticButton>
                      <Link href="/docs/api"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-surface-elevated border border-white/[0.08] hover:border-accent hover:text-accent
                                   text-silver-800 font-semibold text-base transition-all duration-200 w-full sm:w-auto
                                   focus-visible:ring-2 focus-visible:ring-accent/50">
                        View API Docs <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    </>
                  )}
                </div>

                <p className="text-xs text-silver-600">
                  Free forever · No credit card · 50K+ examinations completed
                </p>
              </div>

              {/* Right: Live demo */}
              <div className="w-full max-w-2xl mx-auto lg:max-w-none relative">
                <LiveDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── WHO NEEDS AISCERN ── */}
        <ErrorBoundary>
          <WhoNeedsSection />
        </ErrorBoundary>

        {/* ── AI VS REAL ── */}
        <ErrorBoundary>
          <AIvsRealSection />
        </ErrorBoundary>

        {/* ══ STATS RIBBON ══ */}
        <StatsRibbon />

        {/* ══ TOOLS GRID ══ */}
        <section id="tools" className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
                Six Powerful Tools
              </p>
              <h2 className="text-[32px] sm:text-[40px] font-semibold text-white tracking-[-0.01em] mb-4">
                Attestation Tools
              </h2>
              <p className="text-[#A3A3A3] text-base max-w-xl mx-auto leading-relaxed">
                Six attestation tools covering every content type. Each returns an integrity rating in under 3 seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOOLS.map((tool, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    href={(!user && (tool.href === '/chat' || tool.href === '/batch')) ? '/signup' : tool.href}
                    className={`group block bg-[#141414] border border-[#1E1E1E] rounded-xl p-6 card-lift glow-border-${tool.glow}
                               hover:border-[color:var(--accent)] focus-visible:border-[color:var(--accent)]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40
                               transition-all duration-200`}
                    style={{ '--accent': tool.accent } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                                    bg-[#1A1A1A] border transition-all duration-200 group-hover:scale-110"
                        style={{ borderColor: `${tool.accent}30` }}
                      >
                        <tool.icon className="w-5 h-5 transition-colors duration-200" style={{ color: tool.accent }} strokeWidth={1.8} />
                      </div>
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#1A1A1A] border"
                        style={{ borderColor: `${tool.accent}30`, color: tool.accent }}
                      >
                        {tool.accuracy}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2 transition-colors duration-200">
                      {tool.label}
                    </h3>
                    <p className="text-sm text-[#A3A3A3] leading-relaxed">{tool.desc}</p>
                    <div
                      className="mt-5 flex items-center gap-1 text-xs font-medium text-[#6B6B6B]
                                 group-hover:gap-2 transition-all duration-200"
                    >
                      <span className="group-hover:text-white transition-colors duration-200">Try now</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" style={{ color: tool.accent }} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 border-t border-[#1E1E1E] bg-[#0A0A0A]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
                Simple Process
              </p>
              <h2 className="text-[32px] sm:text-[40px] font-semibold text-white tracking-[-0.01em] mb-4">
                How It Works
              </h2>
              <p className="text-[#A3A3A3] text-base">From submission to verdict in seconds.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = HOW_IT_WORKS_ICONS[i]
                return (
                  <div key={i} className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center
                                      bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex-shrink-0">
                        <Icon className="w-5 h-5 text-[#2BEE34]" strokeWidth={1.7} />
                      </div>
                      <span className="text-xs font-bold text-[#2BEE34] uppercase tracking-[0.08em]">
                        {step.n}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-[#A3A3A3] leading-relaxed">{step.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ══ REVIEWS ══ */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-t border-[#1E1E1E]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
                User Stories
              </p>
              <h2 className="text-[28px] sm:text-[36px] font-semibold text-white tracking-[-0.01em] mb-3">
                What Users Are Saying
              </h2>
              <p className="text-sm text-[#A3A3A3] max-w-lg mx-auto leading-relaxed">
                Real feedback from educators, journalists, HR teams, and researchers.
              </p>
            </div>
            <ErrorBoundary><HomepageReviews /></ErrorBoundary>
            <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="mailto:contact@aiscern.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#2A2A2A]
                           bg-[#1A1A1A] text-sm font-medium text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]
                           transition-all duration-150">
                Share Your Feedback
              </a>
              <Link href="/reviews" className="text-sm text-[#A3A3A3] hover:text-white transition-colors font-medium">
                See all reviews →
              </Link>
            </div>
          </div>
        </section>

        {/* ══ TRUST / FEATURES ══ */}
        <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 border-t border-[#1E1E1E] bg-[#0A0A0A]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
                Trust &amp; Accuracy
              </p>
              <h2 className="text-[32px] sm:text-[40px] font-semibold text-white tracking-[-0.01em]">
                Built for accuracy. Benchmarked on public datasets.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
              {TRUST_FEATURES.map(({ icon: Icon, title, desc, wide, stat, statLabel, accent }, idx) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className={`${wide ? 'sm:col-span-2 glass-premium' : 'bg-[#141414] border border-[#1E1E1E] hover:border-[color:var(--accent)]'}
                              rounded-xl p-6 card-lift transition-all duration-200 relative overflow-hidden`}
                  style={{ '--accent': accent, ...(wide ? { boxShadow: `inset 0 0 0 1px ${accent}20` } : {}) } as React.CSSProperties}
                >
                  {wide && (
                    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)` }} />
                  )}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5 relative"
                    style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                    <Icon className="w-5 h-5" style={{ color: accent }} strokeWidth={1.8} />
                  </div>
                  <div className="mb-3 relative">
                    <div className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                      {/^\d+\+?$/.test(stat)
                        ? <CountUp target={parseInt(stat, 10)} suffix={stat.endsWith('+') ? '+' : ''} />
                        : stat}
                    </div>
                    <div className="text-xs text-[#6B6B6B] font-medium mt-0.5">{statLabel}</div>
                  </div>
                  <h3 className="font-semibold text-white text-base mb-2 relative">{title}</h3>
                  <p className="text-sm text-[#A3A3A3] leading-relaxed relative">{desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Professionals */}
            <div className="mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] mb-5 text-center">
                Built for professionals across
              </p>
              <WhoNeedsCarousel items={PROFESSIONALS} />
            </div>

            {/* Methodology note */}
            <div className="max-w-2xl mx-auto">
              <div className="p-6 sm:p-8 rounded-xl border border-[#1E1E1E] bg-[#141414]">
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical className="w-4 h-4 text-[#2BEE34] flex-shrink-0" />
                  <span className="text-xs font-semibold text-[#2BEE34] uppercase tracking-wider">
                    Attestation methodology
                  </span>
                </div>
                <p className="text-[#A3A3A3] leading-relaxed text-sm">
                  Each examination runs content through multiple independent forensic signals. Results are fused into
                  a single integrity rating using weighted ensemble voting — and a clear Synthesized or Authentic verdict
                  is returned in under 3 seconds.
                </p>
                <div className="mt-4 flex items-center gap-4 flex-wrap">
                  <Link href="/methodology" className="text-xs text-[#2BEE34] hover:text-[#4FFF58] transition-colors font-medium flex items-center gap-1">
                    Read full methodology <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link href="/benchmarks" className="text-xs text-[#A3A3A3] hover:text-white transition-colors font-medium flex items-center gap-1">
                    View benchmarks <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 border-t border-[#1E1E1E]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-[40px] sm:text-[48px] font-bold text-white tracking-[-0.02em] mb-5 leading-tight">
              Start Attesting Content Free
            </h2>
            <p className="text-[#A3A3A3] text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
              Core features free — no credit card required. No account needed for basic examinations.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href={user ? '/dashboard' : '/detect/text'}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                           bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-base font-semibold
                           transition-colors duration-150"
              >
                {user ? 'Go to Dashboard' : 'Begin Attestation Free'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              {user ? (
                <Link
                  href="/chat"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                             bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#2BEE34] hover:text-[#2BEE34]
                             text-[#E5E5E5] text-base font-semibold transition-all duration-150"
                >
                  <MessageSquare className="w-4 h-4" /> Try ARIA Assistant
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                             bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#2BEE34] hover:text-[#2BEE34]
                             text-[#E5E5E5] text-base font-semibold transition-all duration-150"
                >
                  Create Free Account
                </Link>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-[#6B6B6B]">
              {['No credit card required', 'Free tier always available', 'No account for basic examinations'].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2BEE34]/70" />{t}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  )
}
