'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

import WhoNeedsSection from '@/components/home/WhoNeedsSection'
import AIvsRealSection from '@/components/home/AIvsRealSection'
import HomepageReviews from '@/components/home/HomepageReviews'

const DynamicWhoNeedsSection = WhoNeedsSection
const DynamicAIvsRealSection = AIvsRealSection
const DynamicHomepageReviews = HomepageReviews

// ─── CountUp ────────────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (animated) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated) return
      setAnimated(true)
      let start = 0
      const steps = 60; const step = target / steps
      const interval = setInterval(() => {
        start += step
        if (start >= target) { setCount(target); clearInterval(interval) }
        else setCount(Math.floor(start))
      }, 1600 / steps)
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, animated])
  return <span ref={ref} className="counter-value">{count.toLocaleString()}{suffix}</span>
}

// ─── Live Demo ────────────────────────────────────────────────────────────────
function LiveDemo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const analyze = async () => {
    if (text.length < 50) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: null }),
      })
      if (res.status === 401) { router.push('/signup'); setLoading(false); return }
      const d = await res.json()
      if (d.success) { setResult(d.result) }
      else setResult({ verdict: 'UNCERTAIN', summary: d.error?.message || 'Try signing in for full results.' })
    } catch { setResult({ verdict: 'UNCERTAIN', summary: 'Analysis unavailable. Sign in for full access.' }) }
    setLoading(false)
  }
  const examples = [
    { label: 'AI text',    text: 'The intersection of artificial intelligence and human creativity presents a fascinating paradox in contemporary discourse. As machine learning models become increasingly sophisticated in generating coherent, contextually appropriate text, the boundaries between human and algorithmic authorship continue to blur in unprecedented ways.' },
    { label: 'Human text', text: "I spent all weekend trying to fix my leaky faucet and honestly I have no idea what I'm doing. Watched like 6 YouTube videos and still made it worse. Water is now shooting sideways. My neighbor thinks it's hilarious. Calling a plumber tomorrow. RIP my bank account." },
  ]
  return (
    <div className="relative">
      <div className="rounded-xl border border-white/[0.08] bg-[#0f0f17] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-bold text-slate-100">Live AI Detector</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">Free</span>
          </div>
          <div className="flex gap-2">
            {examples.map(ex => (
              <button key={ex.label} onClick={() => setText(ex.text)}
                className="text-xs px-2.5 py-1 rounded-lg border border-white/[0.08] hover:border-blue-500/40 text-slate-400 hover:text-blue-400 transition-all min-h-0">
                {ex.label}
              </button>
            ))}
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste any text to detect if it's AI-generated… (min 50 characters)"
          className="w-full h-24 sm:h-28 bg-[#08080d] border border-white/[0.08] rounded-lg px-3 sm:px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-blue-500/40 transition-all" />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <span className="text-xs text-slate-500">{text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '· ready ✓'}</span>
          <button onClick={analyze} disabled={loading || text.length < 50}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-40 flex items-center gap-2 min-h-[36px] transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Scanning…' : 'Analyze Free'}
          </button>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className={`rounded-xl border p-4 ${result.verdict === 'AI' ? 'bg-rose-500/5 border-rose-500/20' : result.verdict === 'HUMAN' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    {result.verdict === 'AI' ? <XCircle className="w-5 h-5 text-rose-400 shrink-0" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />}
                    <span className={`font-bold text-base ${result.verdict === 'AI' ? 'text-rose-400' : result.verdict === 'HUMAN' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-slate-100 tabular-nums">{formatConfidence(result.confidence || 0)}</div>
                    <div className="text-[10px] text-slate-500">confidence</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[#08080d] overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence <= 1 ? result.confidence * 100 : result.confidence}%` }}
                    transition={{ duration: 1.0, ease: 'easeOut' }}
                    className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-rose-500' : result.verdict === 'HUMAN' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-slate-500">✓ Free · Sign in to save results</p>
                  <Link href="/detect/text" className="text-xs text-blue-400 hover:underline font-medium flex items-center gap-1">
                    Full text detector <ArrowRight className="w-3 h-3" />
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

// ─── Spotlight Card ───────────────────────────────────────────────────────────
function SpotlightCard({ children, className = '' }: {
  children: React.ReactNode; className?: string
}) {
  return (
    <div className={`group relative rounded-xl border border-white/[0.08] hover:border-white/[0.12] transition-colors duration-200 ${className}`}>
      {children}
    </div>
  )
}

// ─── Nav scroll behavior ──────────────────────────────────────────────────────
function useNavScrollBehavior() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
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

// ─── Constants ───────────────────────────────────────────────────────────────
const HOW_IT_WORKS_ICONS = [Layers, Scan, Activity, Wand2]

const TOOLS = [
  { href: '/detect/text',  icon: FileText,      label: 'Free AI Text Detector',           color: 'text-amber-400',     desc: 'Detect ChatGPT, Claude, Gemini & more',           accuracy: '~85%', accent: '#f59e0b' },
  { href: '/detect/image', icon: ImageIcon,     label: 'Deepfake Image Detector',         color: 'text-blue-400',      desc: 'Deepfakes, Midjourney, DALL-E, Stable Diffusion', accuracy: '~82%', accent: '#2563eb' },
  { href: '/detect/audio', icon: Music,         label: 'AI Audio & Voice Clone Detector', color: 'text-slate-300',     desc: 'ElevenLabs, voice cloning, TTS synthesis',        accuracy: '~79%', accent: '#64748b' },
  { href: '/detect/video', icon: Video,         label: 'Free Deepfake Video Detector',    color: 'text-blue-400',      desc: 'Frame-by-frame deepfake analysis',                accuracy: '~76%', accent: '#2563eb' },
  { href: '/chat',         icon: MessageSquare, label: 'AI Detection Assistant',          color: 'text-emerald-400',   desc: 'Ask anything about AI detection',                 accuracy: 'New',  accent: '#10b981' },
  { href: '/batch',        icon: Database,      label: 'Batch AI Content Analyser',       color: 'text-rose-400',      desc: 'Analyze 20 files simultaneously',                 accuracy: '20x',  accent: '#f43f5e' },
]

const STATS = [
  { value: 4,  suffix: '',  label: 'Modalities Covered', icon: Layers   },
  { value: 8,  suffix: '+', label: 'Detection Models',   icon: Brain    },
  { value: 85, suffix: '%', label: 'Text Accuracy (~)',  icon: FileText },
  { value: 79, suffix: '%', label: 'Audio Accuracy (~)', icon: Zap      },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Upload or Paste',   desc: 'Drop any image, video, audio file or paste text / a URL' },
  { n: '02', title: 'Ensemble Analysis', desc: 'Advanced multi-modal AI analyzes 20+ detection signals across all content types' },
  { n: '03', title: 'Get Full Report',   desc: 'Confidence score, signal breakdown & sentence-level heatmap' },
  { n: '04', title: 'Export & Share',    desc: 'Save history, share results, export PDF reports' },
]

const TRUST_FEATURES = [
  { icon: Database,   title: 'Benchmarked Datasets', desc: 'Models evaluated against curated public datasets spanning diverse AI-generated and authentic content from multiple sources.', large: true,  stat: '2.2', statSuffix: 'M+', statLabel: 'training samples' },
  { icon: Shield,     title: 'Research-Backed',       desc: 'Built on peer-reviewed detection research. Every signal validated against real-world AI outputs.',                         large: false, stat: '8',   statSuffix: '+',  statLabel: 'papers cited' },
  { icon: TrendingUp, title: 'Ensemble Models',       desc: 'Multi-model consensus using RoBERTa, ViT, and wav2vec2 — no single model makes the final call.',                        large: false, stat: '20',  statSuffix: '+',  statLabel: 'signals analyzed' },
  { icon: Zap,        title: 'Free Tier Available',   desc: 'Start detecting AI content for free — no credit card required. Upgrade when you need more scans.',                        large: false, stat: 'Free', statSuffix: '', statLabel: 'to start' },
]

const PROFESSIONALS = [
  { label: 'Journalists',      icon: Pen         },
  { label: 'Educators',        icon: GraduationCap },
  { label: 'HR Teams',         icon: Users       },
  { label: 'Legal Pros',       icon: Scale       },
  { label: 'Security Teams',   icon: ShieldCheck },
  { label: 'Researchers',      icon: Microscope  },
  { label: 'Content Creators', icon: Megaphone   },
  { label: 'Marketing Teams',  icon: TrendingUp  },
  { label: 'Healthcare',       icon: Heart       },
]

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { scrolled, hidden } = useNavScrollBehavior()

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

  const [datasetRows, setDatasetRows] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/dataset-stats')
      .then(r => r.json())
      .then(d => { if (d.rows) setDatasetRows(d.rows) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#08080d] text-slate-100 overflow-x-hidden w-full max-w-[100vw]">

      {/* Schema JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `[
        {"@context":"https://schema.org","@type":"WebApplication","@id":"https://aiscern.com/#app","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble-based AI content detection platform for text, images, audio, and video. Free tier available. Published accuracy benchmarks.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"featureList":["AI Text Detection - ChatGPT Claude Gemini","Deepfake Image Detection","AI Audio Voice Clone Detection","Deepfake Video Detection","Batch Analysis","AI Detection API"],"creator":{"@type":"Person","name":"Anas Ali","url":"https://aiscern.com/about"}},
        {"@context":"https://schema.org","@type":"Organization","@id":"https://aiscern.com/#org","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png","foundingDate":"2025","contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"contact@aiscern.com"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses an ensemble approach combining RoBERTa, ViT, and wav2vec2 models. Current benchmarked accuracy: text ~85%, image ~82%, audio ~79%, video ~76%. See /methodology for details."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free tier with 10 scans per day on text and image detection. No credit card required. Pro plans available for audio, video, and higher limits."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion and deepfake faces using a multi-model image analysis ensemble."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a REST API available on Team and Enterprise plans. See aiscern.com/docs/api."}}]}
      ]` }} />

      {/* ══ NAV ══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300
        ${hidden ? 'nav-hidden' : 'nav-visible'}
        bg-[#08080d]/95 border-b ${scrolled ? 'border-white/[0.08]' : 'border-transparent'}`}>
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0" title="Aiscern — Free AI Content Detector">
            <span className="font-black text-xl text-white">Aiscern</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            {[['#tools','Tools'],['#how','How It Works']].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors duration-200">{label}</a>
            ))}
            <Link href={user ? "/chat" : "/signup"} className="hover:text-white transition-colors duration-200 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />AI Chat
            </Link>
            {[['/reviews','Reviews'],[ '/blog','Blog'],['/pricing','Pricing']].map(([href, label]) => (
              <Link key={label} href={href} className="hover:text-white transition-colors duration-200">{label}</Link>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-600/20 transition-all duration-200">
                <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                  {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                </span>
                <span className="hidden sm:inline">Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.08] text-sm font-medium text-slate-300 hover:text-white hover:border-white/[0.12] transition-all duration-200">
                  Sign In
                </Link>
                <Link href="/signup" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors duration-200">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Join</span>
                </Link>
              </>
            )}
            <button className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}>
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              id="mobile-nav-panel"
              role="dialog"
              aria-label="Navigation menu"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              className="md:hidden border-t border-white/[0.06] bg-[#08080d] overflow-hidden">
              <div className="px-4 py-4 flex flex-col gap-1">
                {[
                  { href: '#tools', label: 'Tools', Icon: Cpu },
                  { href: '#how', label: 'How It Works', Icon: Activity },
                  { href: user ? '/chat' : '/signup', label: 'AI Detection Assistant', Icon: MessageSquare },
                  { href: '/reviews', label: 'Reviews', Icon: Star },
                  { href: '/blog', label: 'Blog', Icon: FileText },
                  { href: '/pricing', label: 'Pricing', Icon: Zap },
                ].map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                    <link.Icon className="w-4 h-4" />{link.label}
                  </Link>
                ))}
                {!loading && !user && (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/[0.06]">
                    <Link href="/login" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                      <Lock className="w-4 h-4" />Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setMobileNavOpen(false)} className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
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
        <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 pb-16 sm:pb-24">
          {/* Subtle radial background — no orbs, no mesh */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0f17 0%, #08080d 65%)' }} />

          {/* Content */}
          <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto w-full animate-fade-in-up">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="hidden sm:inline">Ensemble of 8+ detection models · Text, Image, Audio, Video</span>
              <span className="sm:hidden">8+ models · Free tier available</span>
            </div>

            {/* H1 */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-tight mb-6">
              Detect AI Content<br />with Confidence
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Free, accurate detection for text, images, audio, and video. Built on ensemble models with published benchmarks.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              {user ? (
                <>
                  <Link href="/dashboard"
                    className="w-full sm:w-auto px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-medium flex items-center justify-center gap-2 transition-colors duration-200">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/chat" className="w-full sm:w-auto px-8 py-3 rounded-lg border border-white/[0.08] hover:border-white/[0.12] text-slate-300 text-base font-medium flex items-center justify-center gap-2 transition-colors duration-200">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />ARIA Assistant
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/detect/text"
                    className="w-full sm:w-auto px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-medium flex items-center justify-center gap-2 transition-colors duration-200">
                    <Zap className="w-4 h-4" />
                    Start Detecting
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/methodology" className="w-full sm:w-auto px-8 py-3 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-base font-medium flex items-center justify-center gap-2 transition-colors duration-200">
                    View Methodology
                  </Link>
                </>
              )}
            </div>

            {/* Trust bar */}
            <p className="text-sm text-slate-500 mb-12">Free forever · No credit card · 50K+ scans</p>

            {/* Live demo */}
            <div className="max-w-2xl mx-auto w-full">
              <LiveDemo isLoggedIn={!!user} />
            </div>
          </div>
        </section>

        {/* ── WHO NEEDS AISCERN ── */}
        <ErrorBoundary>
          <DynamicWhoNeedsSection />
        </ErrorBoundary>

        {/* ══ STATS BAR ══ */}
        <section className="py-12 sm:py-20 border-y border-white/[0.06] bg-[#0f0f17]/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
              {STATS.map((stat, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="text-center">
                  <div className="text-4xl sm:text-5xl font-bold text-white mb-2 tabular-nums">
                    <CountUp target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI VS REAL ── */}
        <ErrorBoundary>
          <DynamicAIvsRealSection />
        </ErrorBoundary>

        {/* ══ TOOLS GRID ══ */}
        <section id="tools" className="py-16 sm:py-28 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }}
              className="text-center mb-14 sm:mb-20">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">Six Powerful Tools</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-4">
                Detection Tools
              </h2>
              <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
                Six detection tools covering text, images, audio, and video. Each delivers a clear authenticity score in seconds.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TOOLS.map((tool, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}>
                  <Link href={(!user && (tool.href === '/chat' || tool.href === '/batch')) ? '/signup' : tool.href} title={tool.label}>
                    <div className="group rounded-xl border border-white/[0.08] bg-[#0f0f17] p-6 hover:border-white/[0.12] hover:bg-[#141420] hover:-translate-y-0.5 transition-all duration-200 h-full cursor-pointer">
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tool.color}`}
                          style={{ background: `${tool.accent}14`, border: `1px solid ${tool.accent}20` }}>
                          <tool.icon className="w-5 h-5" strokeWidth={1.8} />
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tool.color}`}
                          style={{ background: `${tool.accent}12`, border: `1px solid ${tool.accent}22` }}>
                          {tool.accuracy}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors duration-200">
                        {tool.label}
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{tool.desc}</p>
                      <div className="mt-5 flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-blue-400 transition-colors duration-200">
                        Try now <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="py-16 sm:py-28 px-4 sm:px-6 border-t border-white/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }}
              className="text-center mb-16 sm:mb-20">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">Simple Process</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-4">How It Works</h2>
              <p className="text-slate-400 text-base">From upload to verdict in seconds.</p>
            </motion.div>

            <div className="space-y-10 sm:space-y-16">
              {HOW_IT_WORKS.map((step, i) => {
                const StepIcon = HOW_IT_WORKS_ICONS[i]
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className={`flex items-center gap-6 sm:gap-10 ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                    <div className="flex-1 hidden lg:block" />
                    <div className="relative z-10 flex-shrink-0">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center border border-blue-500/20 bg-blue-500/10">
                        <StepIcon className="w-6 h-6 text-blue-400" strokeWidth={1.7} />
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                          {i + 1}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 max-w-md">
                      <div className="text-xs font-medium text-blue-400/60 uppercase tracking-widest mb-1">{step.n}</div>
                      <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">{step.title}</h3>
                      <p className="text-sm sm:text-base text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ══ REVIEWS ══ */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-t border-white/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }}
              className="text-center mb-12">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">User Stories</p>
              <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight mb-3">What Users Are Saying</h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                Real feedback from users across education, journalism, HR, and research.
              </p>
            </motion.div>

            <ErrorBoundary>
              <DynamicHomepageReviews />
            </ErrorBoundary>

            <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="mailto:contact@aiscern.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-sm font-medium text-blue-400 hover:bg-blue-500/15 transition-all duration-200">
                Share Your Feedback
              </a>
              <Link href="/reviews" className="text-sm text-slate-400 hover:text-white transition-colors font-medium">
                See all reviews →
              </Link>
            </div>
          </div>
        </section>

        {/* ══ TRUST / FEATURES ══ */}
        <section className="py-16 sm:py-28 px-4 sm:px-6 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }}
              className="text-center mb-14">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">Trust & Accuracy</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
                Built for accuracy. Benchmarked on public datasets.
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
              {TRUST_FEATURES.map(({ icon: Icon, title, desc, large, stat, statSuffix, statLabel }, idx) => {
                const isDataset = title === 'Benchmarked Datasets'
                const liveStat = isDataset && datasetRows
                  ? datasetRows >= 1_000_000
                    ? { val: Math.round(datasetRows / 100_000) / 10, suffix: 'M+', label: 'training samples' }
                    : datasetRows >= 1000
                    ? { val: Math.round(datasetRows / 1000), suffix: 'k+', label: 'training samples' }
                    : { val: datasetRows, suffix: '+', label: 'training samples' }
                  : null
                const displayStat   = liveStat ? String(liveStat.val) : stat
                const displaySuffix = liveStat ? liveStat.suffix : statSuffix
                const displayLabel  = liveStat ? liveStat.label : statLabel
                const displayTarget = parseFloat(displayStat) || 0
                return (
                  <motion.div key={title}
                    initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                    className={large ? 'sm:col-span-2 lg:col-span-2' : ''}>
                    <div className="h-full p-6 rounded-xl border border-white/[0.08] bg-[#0f0f17] hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5 border border-white/[0.06] bg-white/[0.03]">
                        <Icon className="w-5 h-5 text-blue-400" strokeWidth={1.8} />
                      </div>
                      {displayStat !== undefined && (
                        <div className="mb-3">
                          <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                            <CountUp target={displayTarget} suffix={displaySuffix} />
                          </div>
                          <div className="text-xs text-slate-500 font-medium">{displayLabel}</div>
                        </div>
                      )}
                      <h3 className="font-semibold text-white text-base mb-2">{title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Professionals */}
            <div className="text-center mb-10">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-5">Built for professionals across</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {PROFESSIONALS.map(({ label, icon: Icon }) => (
                  <span key={label} className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 px-3.5 py-2 rounded-lg border border-white/[0.08] bg-[#0f0f17]/50 hover:border-blue-500/30 hover:text-white transition-colors duration-200 cursor-default">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Methodology note */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-2xl mx-auto text-center p-6 sm:p-8 rounded-xl border border-white/[0.08] bg-[#0f0f17]">
              <div className="flex items-center justify-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">How our detection works</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Each scan analyzes content using multiple independent detection signals. Results are combined into a single confidence score, and a clear AI or Human verdict is returned in seconds.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="py-24 sm:py-32 px-4 sm:px-6 border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }}>
              <div className="flex justify-center mb-8">
                <Image src="/logo.png" alt="Aiscern" width={68} height={80}
                  className="object-contain h-16 sm:h-20 w-auto" />
              </div>

              <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6 leading-tight">
                Start Detecting<br />AI Content Free
              </h2>
              <p className="text-slate-400 text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
                Core features free — no credit card required. No account needed for basic scans.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link href={user ? '/dashboard' : '/detect/text'}
                  className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-medium flex items-center justify-center gap-2 transition-colors duration-200">
                  {user ? 'Go to Dashboard' : 'Start Detecting AI Content Free'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/signup" className="px-8 py-3 rounded-lg border border-white/[0.08] hover:border-white/[0.12] text-slate-300 text-base font-medium flex items-center justify-center gap-2 transition-colors duration-200">
                  Create Free Account
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500">
                {['No credit card required', 'Free tier always available', 'No account for basic scans'].map(t => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />{t}
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
