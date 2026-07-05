'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { formatConfidence } from '@/lib/utils/helpers'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/SiteNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Shield, Brain, FileText, Zap,
  ArrowRight, CheckCircle2, XCircle, HelpCircle,
  Image as ImageIcon, Video, Music,
  Layers, Scan, Activity, Wand2,
  MessageSquare, Database, TrendingUp, Users,
  Loader2, FlaskConical,
  GraduationCap, Scale, ShieldCheck, Microscope, Pen, Megaphone, Heart,
  ScanLine, BarChart3,
} from 'lucide-react'

import HomepageReviews from '@/components/home/HomepageReviews'
import { WhoNeedsCarousel } from '@/components/home/WhoNeedsCarousel'
import WhoNeedsSection from '@/components/home/WhoNeedsSection'
import AIvsRealSection from '@/components/home/AIvsRealSection'
import { HeroHeadline } from '@/components/hero/HeroHeadline'

// ─── CountUp ──────────────────────────────────────────────────────────────────
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

// ─── Live Demo ────────────────────────────────────────────────────────────────
function LiveDemo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [text, setText]     = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router              = useRouter()

  const analyze = async () => {
    if (text.length < 50) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: null }),
      })
      if (res.status === 401) { router.push('/signup'); setLoading(false); return }
      const d = await res.json()
      if (d.success) setResult(d.result)
      else setResult({ verdict: 'UNCERTAIN', summary: d.error?.message || 'Sign in for full results.' })
    } catch {
      setResult({ verdict: 'UNCERTAIN', summary: 'Analysis unavailable. Sign in for full access.' })
    }
    setLoading(false)
  }

  const examples = [
    { label: 'AI text',    text: 'The intersection of artificial intelligence and human creativity presents a fascinating paradox in contemporary discourse. As machine learning models become increasingly sophisticated in generating coherent, contextually appropriate text, the boundaries between human and algorithmic authorship continue to blur in unprecedented ways.' },
    { label: 'Human text', text: "I spent all weekend trying to fix my leaky faucet and honestly I have no idea what I'm doing. Watched like 6 YouTube videos and still made it worse. Water is now shooting sideways. My neighbor thinks it's hilarious. Calling a plumber tomorrow. RIP my bank account." },
  ]

  const verdict   = result?.verdict
  const isAI      = verdict === 'AI'
  const isHuman   = verdict === 'HUMAN'
  const vColor    = isAI ? 'text-[#FF4444]' : isHuman ? 'text-[#2BEE34]' : 'text-[#FFB800]'
  const vBorder   = isAI ? 'border-[#FF4444]/20' : isHuman ? 'border-[#2BEE34]/20' : 'border-[#FFB800]/20'
  const vBg       = isAI ? 'bg-[#FF4444]/5' : isHuman ? 'bg-[#2BEE34]/5' : 'bg-[#FFB800]/5'
  const vBar      = isAI ? 'bg-[#FF4444]' : isHuman ? 'bg-[#2BEE34]' : 'bg-[#FFB800]'

  return (
    <div className="rounded-xl border border-[#1E1E1E] bg-[#0A0A0A] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E1E1E] bg-[#141414]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3A3A3A]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3A3A3A]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#2BEE34]" />
        </div>
        <span className="text-xs font-medium text-[#6B6B6B] ml-1">Live AI Detector</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#2BEE34]/10 text-[#2BEE34] font-semibold border border-[#2BEE34]/20">
          Free
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-2 mb-3">
          {examples.map(ex => (
            <button
              key={ex.label}
              onClick={() => setText(ex.text)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#2A2A2A] hover:border-[#2BEE34]/40
                         text-[#6B6B6B] hover:text-[#2BEE34] transition-all duration-150"
            >
              Try {ex.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste any text to detect if it's AI-generated… (min 50 chars)"
          className="w-full h-24 sm:h-28 bg-[#141414] border border-[#2A2A2A] rounded-lg
                     px-4 py-3 text-sm text-[#E5E5E5] placeholder-[#6B6B6B]
                     resize-none focus:outline-none focus:border-[#2BEE34] focus:ring-1 focus:ring-[#2BEE34]/30
                     transition-all duration-150"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-[#6B6B6B]">
            {text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '· ready ✓'}
          </span>
          <button
            onClick={analyze}
            disabled={loading || text.length < 50}
            className="bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] px-5 py-2
                       text-sm font-semibold rounded-lg disabled:opacity-40
                       flex items-center gap-2 min-h-[38px] transition-all duration-150"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Scanning…' : 'Analyze Free'}
          </button>
        </div>

        {result && (
          <div className={`mt-4 rounded-xl border ${vBorder} ${vBg} p-4 animate-slide-up`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isAI    ? <XCircle     className={`w-5 h-5 ${vColor} shrink-0`} />
               : isHuman ? <CheckCircle2 className={`w-5 h-5 ${vColor} shrink-0`} />
               :           <HelpCircle  className={`w-5 h-5 ${vColor} shrink-0`} />}
                <span className={`font-bold text-base ${vColor}`}>
                  {isAI ? 'AI Generated' : isHuman ? 'Human Written' : 'Uncertain'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white tabular-nums">
                  {formatConfidence(result.confidence || 0)}
                </div>
                <div className="text-[10px] text-[#6B6B6B]">confidence</div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[#1A1A1A] overflow-hidden">
              <div
                className={`h-full rounded-full ${vBar} transition-all duration-700`}
                style={{ width: `${result.confidence <= 1 ? result.confidence * 100 : result.confidence}%` }}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-[#1E1E1E] flex items-center justify-between">
              <p className="text-xs text-[#6B6B6B]">Free · No account needed</p>
              <Link href="/detect/text" className="text-xs text-[#2BEE34] hover:text-[#4FFF58] font-medium flex items-center gap-1 transition-colors">
                Full detector <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

const TOOLS = [
  { href: '/detect/text',  icon: FileText,      label: 'AI Text Detector',           desc: 'ChatGPT, Claude, Gemini & more',            accuracy: '~85%', accent: '#f59e0b', glow: 'text'  },
  { href: '/detect/image', icon: ImageIcon,     label: 'Deepfake Image Detector',    desc: 'Midjourney, DALL-E, Stable Diffusion',      accuracy: '~82%', accent: '#2563eb', glow: 'image' },
  { href: '/detect/audio', icon: Music,         label: 'AI Audio & Voice Detector',  desc: 'ElevenLabs, voice cloning, TTS synthesis',  accuracy: '~79%', accent: '#06b6d4', glow: 'audio' },
  { href: '/detect/video', icon: Video,         label: 'Deepfake Video Detector',    desc: 'Frame-by-frame deepfake analysis',           accuracy: '~76%', accent: '#8b5cf6', glow: 'video' },
  { href: '/chat',         icon: MessageSquare, label: 'ARIA Detection Assistant',   desc: 'Ask anything about AI detection',            accuracy: 'New',  accent: '#2BEE34', glow: 'text'  },
  { href: '/batch',        icon: Database,      label: 'Batch Content Analyser',     desc: 'Analyze 20 files simultaneously',            accuracy: '20×',  accent: '#f43f5e', glow: 'video' },
]

const STATS = [
  { value: 4,  suffix: '',   label: 'Modalities Covered' },
  { value: 8,  suffix: '+',  label: 'Detection Models'   },
  { value: 85, suffix: '%',  label: 'Text Accuracy'      },
  { value: 50, suffix: 'K+', label: 'Scans Completed'    },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste',   desc: 'Drop any image, video, audio file or paste text / a URL — any format, any size.' },
  { n: '02', title: 'Ensemble Analysis', desc: 'Multi-model AI analyzes 20+ detection signals across all content types in parallel.' },
  { n: '03', title: 'Get Full Report',   desc: 'Confidence score, signal breakdown, and sentence-level heatmap in under 3 seconds.' },
  { n: '04', title: 'Export & Share',    desc: 'Save scan history, share results by link, or export full PDF forensic reports.' },
]

const TRUST_FEATURES = [
  { icon: Database,    title: 'Benchmarked Datasets',  desc: 'Models evaluated against curated public datasets spanning AI-generated and authentic content.', wide: true,  stat: '2.2M+', statLabel: 'training samples' },
  { icon: Shield,      title: 'Research-Backed',        desc: 'Built on peer-reviewed detection research. Every signal validated against real-world AI outputs.', wide: false, stat: '8+',    statLabel: 'papers cited' },
  { icon: TrendingUp,  title: 'Ensemble Models',        desc: 'Multi-model consensus — no single model makes the final call. RoBERTa, ViT, and wav2vec2.',     wide: false, stat: '20+',   statLabel: 'signals analyzed' },
  { icon: Zap,         title: 'Free Tier Available',    desc: 'Start detecting for free — no credit card required. Upgrade when you need more scans.',           wide: false, stat: 'Free',  statLabel: 'to start' },
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
        ]) }}
      />

      <SiteNav />

      <main id="main-content">

        {/* ══ HERO ══ */}
        <section className="relative min-h-[100svh] flex items-center overflow-hidden pt-16 pb-16 sm:pb-20">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, #141414 0%, #0A0A0A 60%, #141414 100%)' }} />

          <div className="relative z-10 px-4 sm:px-6 max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* Left: Headline + CTAs */}
              <div className="text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                                border border-[#2BEE34]/20 bg-[#2BEE34]/5 text-[#2BEE34]
                                text-xs font-semibold mb-8 animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34] flex-shrink-0" />
                  <span className="hidden sm:inline">Ensemble of 8+ detection models · Text, Image, Audio, Video</span>
                  <span className="sm:hidden">8+ models · Free tier available</span>
                </div>

                {/* Rotating headline */}
                <div className="mb-6 animate-slide-up flex flex-col items-center lg:items-start">
                  <HeroHeadline />
                </div>

                {/* Subheadline */}
                <p className="text-base sm:text-lg text-[#A3A3A3] max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed animate-slide-up">
                  Free, accurate detection for text, images, audio, and video.
                  Built on ensemble models with published benchmarks.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5 animate-slide-up">
                  {user ? (
                    <>
                      <Link href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold
                                   text-base transition-colors duration-150 w-full sm:w-auto">
                        Dashboard <ArrowRight className="w-4 h-4" />
                      </Link>
                      <Link href="/chat"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#2BEE34] hover:text-[#2BEE34]
                                   text-[#E5E5E5] font-semibold text-base transition-all duration-150 w-full sm:w-auto">
                        <MessageSquare className="w-4 h-4" /> ARIA Assistant
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/detect/text"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold
                                   text-base transition-colors duration-150 w-full sm:w-auto">
                        <ScanLine className="w-4 h-4" /> Start Detecting Free
                      </Link>
                      <Link href="/methodology"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                                   bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#2BEE34] hover:text-[#2BEE34]
                                   text-[#E5E5E5] font-semibold text-base transition-all duration-150 w-full sm:w-auto">
                        View Methodology
                      </Link>
                    </>
                  )}
                </div>

                <p className="text-xs text-[#6B6B6B]">
                  Free forever · No credit card · 50K+ scans completed
                </p>
              </div>

              {/* Right: Live demo */}
              <div className="w-full max-w-2xl mx-auto lg:max-w-none relative">
                <LiveDemo isLoggedIn={!!user} />
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

        {/* ══ STATS BAR ══ */}
        <section className="py-14 sm:py-20 border-y border-[#1E1E1E] bg-[#0A0A0A]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
              {STATS.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-white mb-1.5">
                    <CountUp target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-[#6B6B6B] text-xs sm:text-sm font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TOOLS GRID ══ */}
        <section id="tools" className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
                Six Powerful Tools
              </p>
              <h2 className="text-[32px] sm:text-[40px] font-semibold text-white tracking-[-0.01em] mb-4">
                Detection Tools
              </h2>
              <p className="text-[#A3A3A3] text-base max-w-xl mx-auto leading-relaxed">
                Six detection tools covering every content type. Each returns a confidence score in under 3 seconds.
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
                               hover:border-[${tool.accent}40] transition-all duration-200`}
                    style={{ '--tw-shadow-color': tool.accent } as React.CSSProperties}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${tool.accent}40` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
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
              <p className="text-[#A3A3A3] text-base">From upload to verdict in seconds.</p>
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
              {TRUST_FEATURES.map(({ icon: Icon, title, desc, wide, stat, statLabel }) => (
                <div
                  key={title}
                  className={`${wide ? 'sm:col-span-2' : ''} bg-[#141414] border border-[#1E1E1E] rounded-xl p-6
                              hover:border-[#2A2A2A] transition-all duration-200`}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5
                                  bg-[#1A1A1A] border border-[#2A2A2A]">
                    <Icon className="w-5 h-5 text-[#2BEE34]" strokeWidth={1.8} />
                  </div>
                  <div className="mb-3">
                    <div className="text-3xl sm:text-4xl font-black text-white">{stat}</div>
                    <div className="text-xs text-[#6B6B6B] font-medium mt-0.5">{statLabel}</div>
                  </div>
                  <h3 className="font-semibold text-white text-base mb-2">{title}</h3>
                  <p className="text-sm text-[#A3A3A3] leading-relaxed">{desc}</p>
                </div>
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
                    Detection methodology
                  </span>
                </div>
                <p className="text-[#A3A3A3] leading-relaxed text-sm">
                  Each scan runs content through multiple independent detection signals. Results are fused into
                  a single confidence score using weighted ensemble voting — and a clear AI or Human verdict
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
              Start Detecting AI Content Free
            </h2>
            <p className="text-[#A3A3A3] text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
              Core features free — no credit card required. No account needed for basic scans.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href={user ? '/dashboard' : '/detect/text'}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                           bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-base font-semibold
                           transition-colors duration-150"
              >
                {user ? 'Go to Dashboard' : 'Start Detecting Free'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                           bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#2BEE34] hover:text-[#2BEE34]
                           text-[#E5E5E5] text-base font-semibold transition-all duration-150"
              >
                Create Free Account
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-[#6B6B6B]">
              {['No credit card required', 'Free tier always available', 'No account for basic scans'].map(t => (
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
