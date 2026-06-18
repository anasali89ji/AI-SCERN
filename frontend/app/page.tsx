'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { formatConfidence } from '@/lib/utils/helpers'
import { SiteFooter } from '@/components/site-footer'
import { HeroHeadline } from '@/components/hero/HeroHeadline'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Shield, Brain, Eye, FileText, Globe, Zap,
  ArrowRight, CheckCircle, XCircle, HelpCircle,
  Image as ImageIcon, Video, Music, ChevronRight, Loader2,
  MessageSquare, Cpu, Lock, Database, Sparkles,
  TrendingUp, Users, Menu, X, Search,
  Scan, Bot,
  Activity, Layers, Wand2, Star, ChevronDown, FlaskConical, GraduationCap,
  Scale, ShieldCheck, Microscope, Pen, Megaphone, Heart,
} from 'lucide-react'

import WhoNeedsSection   from '@/components/home/WhoNeedsSection'
import AIvsRealSection   from '@/components/home/AIvsRealSection'
import HomepageReviews   from '@/components/home/HomepageReviews'

// ─── CountUp ─────────────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount]       = useState(0)
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (animated) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated) return
      setAnimated(true)
      let start = 0
      const steps  = 60
      const step   = target / steps
      const id = setInterval(() => {
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
  const [text, setText]   = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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

  const verdictColor = result?.verdict === 'AI'    ? { text: 'text-rose-400',    border: 'border-rose-500/20',    bg: 'bg-rose-500/[0.06]',    bar: 'bg-rose-500'    }
                     : result?.verdict === 'HUMAN'  ? { text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.06]', bar: 'bg-emerald-500' }
                     :                               { text: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.06]',   bar: 'bg-amber-500'   }

  return (
    <div className="rounded-[14px] border border-white/[0.10] bg-[#0f0f17] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07] bg-[#08080d]/50">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-xs font-medium text-slate-500 ml-1">Live AI Detector</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
          Free
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {/* Example buttons */}
        <div className="flex gap-2 mb-3">
          {examples.map(ex => (
            <button key={ex.label} onClick={() => setText(ex.text)}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-blue-500/30
                         text-slate-400 hover:text-blue-400 transition-all duration-200">
              Try {ex.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste any text to detect if it's AI-generated… (min 50 chars)"
          className="w-full h-24 sm:h-28 bg-[#08080d] border border-white/[0.08] rounded-xl
                     px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600
                     resize-none focus:outline-none focus:border-blue-500/40 transition-all duration-200"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-600">
            {text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '· ready ✓'}
          </span>
          <button
            onClick={analyze}
            disabled={loading || text.length < 50}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2
                       text-sm font-semibold rounded-xl disabled:opacity-40
                       flex items-center gap-2 min-h-[38px] transition-all duration-200">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Scanning…' : 'Analyze Free'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22,1,0.36,1] }}
              className="mt-4 overflow-hidden"
            >
              <div className={`rounded-xl border ${verdictColor.border} ${verdictColor.bg} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {result.verdict === 'AI'
                      ? <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      : result.verdict === 'HUMAN'
                      ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      : <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />}
                    <span className={`font-bold text-base ${verdictColor.text}`}>
                      {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-100 tabular-nums">
                      {formatConfidence(result.confidence || 0)}
                    </div>
                    <div className="text-[10px] text-slate-500">confidence</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[#08080d] overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, ease: [0.22,1,0.36,1] }}
                    style={{ originX: 0, width: `${result.confidence <= 1 ? result.confidence * 100 : result.confidence}%` }}
                    className={`h-full rounded-full ${verdictColor.bar}`}
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <p className="text-xs text-slate-500">✓ Free · No account needed</p>
                  <Link href="/detect/text" className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors">
                    Full detector <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Nav scroll behavior ──────────────────────────────────────────────────────
function useNavScrollBehavior() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden]     = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      if (y > lastY.current + 10 && y > 100) setHidden(true)
      else if (y < lastY.current - 5) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return { scrolled, hidden }
}

// ─── Stagger container ────────────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22,1,0.36,1] } },
}

// ─── Constants ───────────────────────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

const TOOLS = [
  { href: '/detect/text',  icon: FileText,      label: 'AI Text Detector',           color: 'text-amber-400',   desc: 'ChatGPT, Claude, Gemini & more',           accuracy: '~85%', accent: '#f59e0b' },
  { href: '/detect/image', icon: ImageIcon,     label: 'Deepfake Image Detector',    color: 'text-blue-400',    desc: 'Midjourney, DALL-E, Stable Diffusion',     accuracy: '~82%', accent: '#3b82f6' },
  { href: '/detect/audio', icon: Music,         label: 'AI Audio & Voice Detector',  color: 'text-violet-400',  desc: 'ElevenLabs, voice cloning, TTS synthesis',  accuracy: '~79%', accent: '#8b5cf6' },
  { href: '/detect/video', icon: Video,         label: 'Deepfake Video Detector',    color: 'text-emerald-400', desc: 'Frame-by-frame deepfake analysis',           accuracy: '~76%', accent: '#10b981' },
  { href: '/chat',         icon: MessageSquare, label: 'ARIA Detection Assistant',   color: 'text-sky-400',     desc: 'Ask anything about AI detection',           accuracy: 'New',  accent: '#0ea5e9' },
  { href: '/batch',        icon: Database,      label: 'Batch Content Analyser',     color: 'text-rose-400',    desc: 'Analyze 20 files simultaneously',           accuracy: '20×',  accent: '#f43f5e' },
]

const STATS = [
  { value: 4,  suffix: '',   label: 'Modalities Covered', icon: Layers   },
  { value: 8,  suffix: '+',  label: 'Detection Models',   icon: Brain    },
  { value: 85, suffix: '%',  label: 'Text Accuracy',      icon: FileText },
  { value: 79, suffix: '%',  label: 'Audio Accuracy',     icon: Zap      },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste',   desc: 'Drop any image, video, audio file or paste text / a URL — any format, any size.' },
  { n: '02', title: 'Ensemble Analysis', desc: 'Multi-model AI analyzes 20+ detection signals across all content types in parallel.' },
  { n: '03', title: 'Get Full Report',   desc: 'Confidence score, signal breakdown, and sentence-level heatmap in under 3 seconds.' },
  { n: '04', title: 'Export & Share',    desc: 'Save scan history, share results by link, or export full PDF forensic reports.' },
]

const TRUST_FEATURES = [
  { icon: Database,   title: 'Benchmarked Datasets',  desc: 'Models evaluated against curated public datasets spanning AI-generated and authentic content.', wide: true,  stat: '2.2M+', statLabel: 'training samples' },
  { icon: Shield,     title: 'Research-Backed',        desc: 'Built on peer-reviewed detection research. Every signal validated against real-world AI outputs.', wide: false, stat: '8+',    statLabel: 'papers cited' },
  { icon: TrendingUp, title: 'Ensemble Models',        desc: 'Multi-model consensus — no single model makes the final call. RoBERTa, ViT, and wav2vec2.',    wide: false, stat: '20+',   statLabel: 'signals analyzed' },
  { icon: Zap,        title: 'Free Tier Available',    desc: 'Start detecting for free — no credit card required. Upgrade when you need more scans.',          wide: false, stat: 'Free',  statLabel: 'to start' },
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

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading }   = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { scrolled, hidden } = useNavScrollBehavior()
  const [datasetRows, setDatasetRows] = useState<number | null>(null)

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow  = 'hidden'
      document.body.style.position  = 'fixed'
      document.body.style.width     = '100%'
    } else {
      document.body.style.overflow  = ''
      document.body.style.position  = ''
      document.body.style.width     = ''
    }
    return () => {
      document.body.style.overflow  = ''
      document.body.style.position  = ''
      document.body.style.width     = ''
    }
  }, [mobileNavOpen])

  useEffect(() => {
    fetch('/api/dataset-stats')
      .then(r => r.json())
      .then(d => { if (d.rows) setDatasetRows(d.rows) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#08080d] text-slate-100 overflow-x-hidden w-full max-w-[100vw]">

      {/* Schema JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {"@context":"https://schema.org","@type":"WebApplication","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble AI content detection for text, images, audio, and video.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}},
        {"@context":"https://schema.org","@type":"Organization","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png"},
      ]) }} />

      {/* ══ NAV ══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300
        ${hidden ? 'nav-hidden' : 'nav-visible'}
        ${scrolled
          ? 'bg-[#08080d]/90 border-b border-white/[0.08]'
          : 'bg-transparent border-b border-transparent'}
        backdrop-blur-xl`}
        style={{ WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <span className="font-black text-xl text-white tracking-tight group-hover:text-blue-400 transition-colors duration-200">
              Aiscern
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-400">
            {[['#tools','Tools'],['#how','How It Works']].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors duration-200">{label}</a>
            ))}
            <Link href={user ? '/chat' : '/signup'}
              className="hover:text-white transition-colors duration-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />AI Chat
            </Link>
            {[['/reviews','Reviews'],['/pricing','Pricing'],['/blog','Blog']].map(([href, label]) => (
              <Link key={label} href={href} className="hover:text-white transition-colors duration-200">{label}</Link>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link href="/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                           bg-blue-600/10 border border-blue-500/25 text-blue-400
                           text-sm font-semibold hover:bg-blue-600/20 transition-all duration-200">
                <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                  {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                </span>
                <span className="hidden sm:inline">Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login"
                  className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl
                             border border-white/[0.08] text-sm font-medium text-slate-300
                             hover:text-white hover:border-white/[0.14] transition-all duration-200">
                  Sign In
                </Link>
                <Link href="/signup"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                             bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                             text-white text-sm font-semibold transition-colors duration-200">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Join</span>
                </Link>
              </>
            )}
            <button
              className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white transition-colors"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileNavOpen
                  ? <motion.span key="x"    initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}} transition={{duration:0.15}}><X className="w-5 h-5" /></motion.span>
                  : <motion.span key="menu" initial={{rotate:90,opacity:0}}  animate={{rotate:0,opacity:1}} exit={{rotate:-90,opacity:0}} transition={{duration:0.15}}><Menu className="w-5 h-5" /></motion.span>
                }
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              role="dialog" aria-label="Navigation menu"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22,1,0.36,1] }}
              className="md:hidden border-t border-white/[0.07] bg-[#08080d]/98 overflow-hidden"
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <div className="px-4 py-4 flex flex-col gap-1">
                {[
                  { href: '#tools',                      label: 'Tools',                 Icon: Cpu         },
                  { href: '#how',                        label: 'How It Works',          Icon: Activity    },
                  { href: user ? '/chat' : '/signup',    label: 'ARIA AI Assistant',     Icon: MessageSquare },
                  { href: '/reviews',                    label: 'Reviews',               Icon: Star        },
                  { href: '/blog',                       label: 'Blog',                  Icon: FileText    },
                  { href: '/pricing',                    label: 'Pricing',               Icon: Zap         },
                ].map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400
                               hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                    <link.Icon className="w-4 h-4" />{link.label}
                  </Link>
                ))}
                {!loading && !user && (
                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-white/[0.07]">
                    <Link href="/login" onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400
                                 hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                      <Lock className="w-4 h-4" />Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setMobileNavOpen(false)}
                      className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl
                                 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                      <Zap className="w-4 h-4" />Get Started Free
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main id="main-content">

        {/* ══ HERO ══ */}
        <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 pb-20 sm:pb-28 hero-bg">
          {/* Radial vignette */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, #08080d 100%)' }} />

          <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto w-full">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                         border border-blue-500/25 bg-blue-500/[0.08] text-blue-400
                         text-xs font-semibold mb-8 sm:mb-10"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
              <span className="hidden sm:inline">Ensemble of 8+ detection models · Text, Image, Audio, Video</span>
              <span className="sm:hidden">8+ models · Free tier available</span>
            </motion.div>

            {/* Headline */}
            <HeroHeadline />

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.35, ease: [0.22,1,0.36,1] }}
              className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-8 mb-8 sm:mb-10 leading-relaxed"
            >
              Free, accurate detection for text, images, audio, and video.
              Built on ensemble models with published benchmarks.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.44, ease: [0.22,1,0.36,1] }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5"
            >
              {user ? (
                <>
                  <Link href="/dashboard" className="btn-primary w-full sm:w-auto px-8 py-3 text-base">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/chat" className="btn-secondary w-full sm:w-auto px-8 py-3 text-base">
                    <MessageSquare className="w-4 h-4 text-sky-400" />ARIA Assistant
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/detect/text" className="btn-primary w-full sm:w-auto px-8 py-3 text-base">
                    <Zap className="w-4 h-4" />Start Detecting <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/methodology" className="btn-secondary w-full sm:w-auto px-8 py-3 text-base">
                    View Methodology
                  </Link>
                </>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.58 }}
              className="text-xs text-slate-600 mb-10"
            >
              Free forever · No credit card · 50K+ scans
            </motion.p>

            {/* Live demo */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.52, ease: [0.22,1,0.36,1] }}
              className="max-w-2xl mx-auto w-full"
            >
              <LiveDemo isLoggedIn={!!user} />
            </motion.div>
          </div>
        </section>

        {/* ── WHO NEEDS AISCERN ── */}
        <ErrorBoundary><WhoNeedsSection /></ErrorBoundary>

        {/* ══ STATS BAR ══ */}
        <section className="py-14 sm:py-20 border-y border-white/[0.06] bg-[#0f0f17]/60">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12"
            >
              {STATS.map((stat, i) => (
                <motion.div key={i} variants={staggerItem} className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-white mb-1.5">
                    <CountUp target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── AI VS REAL ── */}
        <ErrorBoundary><AIvsRealSection /></ErrorBoundary>

        {/* ══ TOOLS GRID ══ */}
        <section id="tools" className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14 sm:mb-18"
            >
              <p className="section-eyebrow mb-3">Six Powerful Tools</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                Detection Tools
              </h2>
              <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
                Six detection tools covering every content type. Each returns a confidence score in under 3 seconds.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {TOOLS.map((tool, i) => (
                <motion.div key={i} variants={staggerItem} className="tool-card-wrap">
                  <Link
                    href={(!user && (tool.href === '/chat' || tool.href === '/batch')) ? '/signup' : tool.href}
                    title={tool.label}
                    className="block tool-card-inner border border-white/[0.08] hover:border-white/[0.13] transition-colors duration-200"
                  >
                    <div className="p-6 h-full flex flex-col group">
                      <div className="flex items-start justify-between mb-5">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${tool.accent}18`, border: `1px solid ${tool.accent}28` }}
                        >
                          <tool.icon className={`w-5 h-5 ${tool.color}`} strokeWidth={1.8} />
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${tool.color}`}
                          style={{ background: `${tool.accent}12`, border: `1px solid ${tool.accent}22` }}
                        >
                          {tool.accuracy}
                        </span>
                      </div>
                      <h3 className={`text-base font-semibold text-white mb-2 transition-colors duration-200 group-hover:${tool.color}`}>
                        {tool.label}
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed flex-1">{tool.desc}</p>
                      <div className="mt-5 flex items-center gap-1 text-xs font-medium text-slate-600 group-hover:text-slate-300 transition-colors duration-200">
                        Try now <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 border-t border-white/[0.06] bg-[#0f0f17]/40">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16 sm:mb-20"
            >
              <p className="section-eyebrow mb-3">Simple Process</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">How It Works</h2>
              <p className="text-slate-400 text-base">From upload to verdict in seconds.</p>
            </motion.div>

            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-6 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent hidden sm:block" />

              <div className="space-y-10 sm:space-y-0">
                {HOW_IT_WORKS.map((step, i) => {
                  const Icon    = HOW_IT_WORKS_ICONS[i]
                  const isRight = i % 2 === 0
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className={`relative sm:grid sm:grid-cols-2 sm:gap-16 sm:items-center sm:pb-16`}
                    >
                      {/* Content — alternates sides */}
                      <div className={`${isRight ? 'sm:text-right sm:pr-8' : 'sm:col-start-2 sm:pl-8'} flex sm:block gap-4 sm:gap-0`}>
                        {/* Mobile: icon inline */}
                        <div className="sm:hidden flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
                            <Icon className="w-5 h-5 text-blue-400" strokeWidth={1.7} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-blue-500/50 uppercase tracking-widest mb-1">{step.n}</div>
                          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{step.title}</h3>
                          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>

                      {/* Center icon — desktop */}
                      <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center justify-center z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#0f0f17] border border-blue-500/25 shadow-[0_0_0_4px_#08080d]">
                          <Icon className="w-5 h-5 text-blue-400" strokeWidth={1.7} />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ══ REVIEWS ══ */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-t border-white/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <p className="section-eyebrow mb-3">User Stories</p>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-3">What Users Are Saying</h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                Real feedback from educators, journalists, HR teams, and researchers.
              </p>
            </motion.div>
            <ErrorBoundary><HomepageReviews /></ErrorBoundary>
            <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="mailto:contact@aiscern.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-500/25
                           bg-blue-500/[0.08] text-sm font-medium text-blue-400 hover:bg-blue-500/[0.14]
                           transition-all duration-200">
                Share Your Feedback
              </a>
              <Link href="/reviews" className="text-sm text-slate-400 hover:text-white transition-colors font-medium">
                See all reviews →
              </Link>
            </div>
          </div>
        </section>

        {/* ══ TRUST / FEATURES ══ */}
        <section className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="section-eyebrow mb-3">Trust & Accuracy</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Built for accuracy.<br className="sm:hidden" /> Benchmarked on public datasets.
              </h2>
            </motion.div>

            {/* Bento trust grid */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14"
            >
              {TRUST_FEATURES.map(({ icon: Icon, title, desc, wide, stat, statLabel }, idx) => (
                <motion.div
                  key={title}
                  variants={staggerItem}
                  className={wide ? 'sm:col-span-2' : ''}
                >
                  <div className="h-full p-6 rounded-[14px] border border-white/[0.08] bg-[#0f0f17]
                                  hover:border-white/[0.13] hover:-translate-y-px transition-all duration-200">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5
                                    border border-white/[0.07] bg-white/[0.03]">
                      <Icon className="w-5 h-5 text-blue-400" strokeWidth={1.8} />
                    </div>
                    <div className="mb-3">
                      <div className="text-3xl sm:text-4xl font-black text-white">{stat}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{statLabel}</div>
                    </div>
                    <h3 className="font-semibold text-white text-base mb-2">{title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Professionals pill cloud */}
            <div className="text-center mb-12">
              <p className="section-eyebrow mb-5">Built for professionals across</p>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                className="flex flex-wrap items-center justify-center gap-2.5"
              >
                {PROFESSIONALS.map(({ label, icon: Icon }) => (
                  <motion.span
                    key={label}
                    variants={staggerItem}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-400
                               px-4 py-2 rounded-xl border border-white/[0.08] bg-[#0f0f17]/80
                               hover:border-blue-500/25 hover:text-white transition-all duration-200 cursor-default"
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                    {label}
                  </motion.span>
                ))}
              </motion.div>
            </div>

            {/* Methodology note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <div className="p-6 sm:p-8 rounded-[14px] border border-white/[0.08] bg-[#0f0f17]
                              font-mono text-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider not-italic">
                    Detection methodology
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed not-italic font-sans text-sm">
                  Each scan runs content through multiple independent detection signals. Results are fused into
                  a single confidence score using weighted ensemble voting — and a clear AI or Human verdict
                  is returned in under 3 seconds.
                </p>
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <Link href="/methodology" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-sans not-italic font-medium flex items-center gap-1">
                    Read full methodology <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link href="/benchmarks" className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-sans not-italic font-medium flex items-center gap-1">
                    View benchmarks <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 border-t border-white/[0.06] relative overflow-hidden">
          {/* Focal radial — NOT an orb, just a soft center light */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(37,99,235,0.07) 0%, transparent 70%)' }} />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: [0.22,1,0.36,1] }}
            >
              <div className="flex justify-center mb-8">
                <Image src="/logo.png" alt="Aiscern" width={64} height={80} className="object-contain h-16 sm:h-20 w-auto opacity-90" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-5 leading-tight">
                Start Detecting<br />AI Content Free
              </h2>
              <p className="text-slate-400 text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
                Core features free — no credit card required. No account needed for basic scans.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href={user ? '/dashboard' : '/detect/text'}
                  className="btn-primary px-8 py-3.5 text-base"
                >
                  {user ? 'Go to Dashboard' : 'Start Detecting Free'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/signup" className="btn-secondary px-8 py-3.5 text-base">
                  Create Free Account
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500">
                {['No credit card required', 'Free tier always available', 'No account for basic scans'].map(t => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500/70" />{t}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  )
}
