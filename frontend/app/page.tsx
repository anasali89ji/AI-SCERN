import { SiteFooter } from '@/components/site-footer'
import { HeroHeadline } from '@/components/hero/HeroHeadline'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Reveal } from '@/components/motion/Reveal'
import { HomeHeader } from '@/components/home/HomeHeader'
import { HeroFloatingCards } from '@/components/home/HeroFloatingCards'
import { HeroCTAButtons } from '@/components/home/HeroCTAButtons'
import { HeroScrollIndicator } from '@/components/home/HeroScrollIndicator'
import { SpotlightCard } from '@/components/home/SpotlightCard'
import { ToolLink } from '@/components/home/ToolLink'
import { CountUp } from '@/components/home/CountUp'
import { DatasetStatValue } from '@/components/home/DatasetStatValue'
import {
  Shield, Brain, FileText, Zap,
  ArrowRight, ChevronRight,
  Image as ImageIcon, Video, Music,
  MessageSquare, Cpu, Database,
  TrendingUp, Users, Search,
  Layers, FlaskConical, GraduationCap,
  Scale, ShieldCheck, Microscope, Pen, Megaphone, Heart,
} from 'lucide-react'

// ─── Sections (SSR enabled — critical for render) ────────────────────────────
// Static imports — no Suspense boundaries, no skeleton flash, no $RC JS dependency
// dynamic() caused sections to show as skeleton placeholders when JS was slow
import EnterpriseTrustBanner from '@/components/home/EnterpriseTrustBanner'
import WhoWeServeSection from '@/components/home/WhoWeServeSection'
import WhyChooseSection from '@/components/home/WhyChooseSection'
import HowItWorksSection from '@/components/home/HowItWorksSection'
import IndustrySolutionsSection from '@/components/home/IndustrySolutionsSection'
import TechnologySection from '@/components/home/TechnologySection'
import SecuritySection from '@/components/home/SecuritySection'
import InteractiveDemoSection from '@/components/home/InteractiveDemoSection'
import StatisticsSection from '@/components/home/StatisticsSection'
import TestimonialsSection from '@/components/home/TestimonialsSection'
import FAQSection from '@/components/home/FAQSection'
import FinalCTASection from '@/components/home/FinalCTASection'

// ─── CSS-only Network Background (replaces canvas ParticleNetwork) ────────────
// The canvas requestAnimationFrame + filter:blur combo on mobile causes GPU
// compositing overflow → purple/blue scanline glitch artifacts on Android/iOS.
// No hooks/motion here — safe to stay server-rendered.
function NetworkBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.06)_0%,transparent_50%)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/[0.03] rounded-full blur-[120px] blur-orb hidden sm:block" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/[0.03] rounded-full blur-[100px] blur-orb hidden sm:block" />
      {/* Dot grid hidden on mobile/low-power devices to prevent GPU glitches */}
      <div className="absolute inset-0 opacity-[0.015] hidden sm:block"
           style={{ backgroundImage: 'radial-gradient(circle, rgba(37,99,235,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    </div>
  )
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOOLS = [
  { href: '/detect/text',  icon: FileText,      label: 'Free AI Text Detector',           color: 'text-amber',     bg: 'from-amber/20 via-amber/8 to-transparent',          border: 'border-amber/25',     desc: 'Detect ChatGPT, Claude, Gemini & more',           accuracy: '~94%', accent: '#f59e0b' },
  { href: '/detect/image', icon: ImageIcon,     label: 'Deepfake Image Detector',         color: 'text-primary',   bg: 'from-primary/20 via-primary/8 to-transparent',      border: 'border-primary/25',   desc: 'Deepfakes, Midjourney, DALL-E, Stable Diffusion', accuracy: '~98%', accent: '#2563eb' },
  { href: '/detect/audio', icon: Music,         label: 'AI Audio & Voice Clone Detector', color: 'text-cyan',      bg: 'from-cyan/20 via-cyan/8 to-transparent',            border: 'border-cyan/25',      desc: 'ElevenLabs, voice cloning, TTS synthesis',        accuracy: '~91%', accent: '#06b6d4' },
  { href: '/detect/video', icon: Video,         label: 'Free Deepfake Video Detector',    color: 'text-violet-400',bg: 'from-violet-500/20 via-violet-500/8 to-transparent',border: 'border-violet-500/25',desc: 'Frame-by-frame deepfake analysis',                accuracy: '~88%', accent: '#8b5cf6' },
  { href: '/chat',         icon: MessageSquare, label: 'AI Detection Assistant',          color: 'text-emerald',   bg: 'from-emerald/20 via-emerald/8 to-transparent',      border: 'border-emerald/25',   desc: 'Ask anything about AI detection',                 accuracy: 'New',  accent: '#10b981' },
  { href: '/batch',        icon: Database,      label: 'Batch AI Content Analyser',       color: 'text-rose',      bg: 'from-rose/20 via-rose/8 to-transparent',            border: 'border-rose/25',      desc: 'Analyze 20 files simultaneously',                 accuracy: '20x',  accent: '#f43f5e' },
]

const STATS = [
  { value: 4,  suffix: '',  label: 'Modalities Covered', icon: Layers   },
  { value: 8,  suffix: '+', label: 'Detection Models',   icon: Brain    },
  { value: 85, suffix: '%', label: 'Text Accuracy (~)',  icon: FileText },
  { value: 79, suffix: '%', label: 'Audio Accuracy (~)', icon: Zap      },
]

const TRUST_FEATURES = [
  { icon: Database,   color: 'text-primary', bg: 'from-primary/18 to-transparent', border: 'border-primary/20', title: 'Benchmarked Datasets', desc: 'Models evaluated against curated public datasets spanning diverse AI-generated and authentic content from multiple sources.', large: true,  stat: '2.2', statSuffix: 'M+', statLabel: 'training samples', accent: '#2563eb' },
  { icon: Shield,     color: 'text-emerald', bg: 'from-emerald/18 to-transparent', border: 'border-emerald/20', title: 'Research-Backed',       desc: 'Built on peer-reviewed detection research. Every signal validated against real-world AI outputs.',                         large: false, stat: '8',   statSuffix: '+',  statLabel: 'papers cited',    accent: '#10b981' },
  { icon: TrendingUp, color: 'text-amber',   bg: 'from-amber/18 to-transparent',   border: 'border-amber/20',   title: 'Ensemble Models',       desc: 'Multi-model consensus using RoBERTa, ViT, and wav2vec2 — no single model makes the final call.',                        large: false, stat: '20',  statSuffix: '+',  statLabel: 'signals analyzed', accent: '#f59e0b' },
  { icon: Zap,        color: 'text-cyan',    bg: 'from-cyan/18 to-transparent',     border: 'border-cyan/20',    title: 'Flexible Access',       desc: 'Start with a free scan to see the platform in action, then scale up through self-serve plans or an enterprise agreement.',                        large: false, stat: 'Free', statSuffix: '', statLabel: 'to start',        accent: '#06b6d4' },
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

// ─── Main Page (Server Component) ─────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden w-full max-w-[100vw]">

      {/* Schema JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `[
        {"@context":"https://schema.org","@type":"WebApplication","@id":"https://aiscern.com/#app","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble-based AI content detection platform for text, images, audio, and video. Free tier available. Published accuracy benchmarks.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"featureList":["AI Text Detection - ChatGPT Claude Gemini","Deepfake Image Detection","AI Audio Voice Clone Detection","Deepfake Video Detection","Batch Analysis","AI Detection API"],"creator":{"@type":"Person","name":"Anas Ali","url":"https://aiscern.com/about"}},
        {"@context":"https://schema.org","@type":"Organization","@id":"https://aiscern.com/#org","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png","foundingDate":"2025","contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"contact@aiscern.com"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses a 14-layer ensemble combining ViT classifiers, RoBERTa, wav2vec2, and physics-based signal analysis (Bayer demosaicing, polarization, subsurface scattering, sensor QE matching). Benchmarked accuracy: text ~94% (F1 0.965, AUC 0.98), image ~98% (AUC 0.98, 14 layers), audio ~91% (AUC 0.95), video ~88% (AUC 0.93). See /benchmarks for full results."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free tier with 10 scans per day on text and image detection. No credit card required. Pro plans available for audio, video, and higher limits."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion, SDXL, FLUX, Gemini, and Grok images using a 14-layer ensemble including physics-based Bayer pattern analysis (L12-BDIS) with 100% recall across all major generators."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a REST API available on Team and Enterprise plans. See aiscern.com/docs/api."}}]}
      ]` }} />

      <HomeHeader />

      <main id="main-content">

        {/* ══ HERO ══ */}
        <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-24 sm:pt-28 lg:pt-32 pb-12 sm:pb-20">

          {/* Animated mesh gradients */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="hero-mesh-1 absolute top-1/4 left-1/3 w-[700px] h-[700px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 70%)', filter: 'blur(80px)' }} />
            <div className="hero-mesh-2 absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.09) 0%, transparent 70%)', filter: 'blur(100px)' }} />
            <div className="hero-mesh-3 absolute bottom-1/4 left-1/5 w-[500px] h-[500px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
          </div>

          <NetworkBackground />
          <HeroFloatingCards />

          {/* Center glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 65%)' }} />

          {/* Content */}
          <div className="relative z-20 text-center px-5 sm:px-8 md:px-10 lg:px-4 max-w-[92vw] sm:max-w-lg md:max-w-2xl lg:max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl mx-auto w-full">

            {/* Animated badge */}
            <Reveal trigger="mount" duration={0.5}
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] sm:text-xs font-semibold mb-3 sm:mb-7">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="hidden sm:inline">Enterprise AI Verification Platform · Text, Image, Audio, Video</span>
              <span className="sm:hidden">Enterprise AI Verification Platform</span>
            </Reveal>

            {/* H1 + Rotating modality animation */}
            <div className="mb-4 sm:mb-7">
              <HeroHeadline />
            </div>

            {/* Subheadline */}
            <Reveal trigger="mount" duration={0.6} delay={0.2}
              as="span"
              className="block text-sm sm:text-lg text-text-secondary max-w-xl mx-auto mb-7 sm:mb-10 leading-relaxed">
              <span className="sm:hidden">Enterprise AI Verification Platform for text, images, audio &amp; video.</span>
              <span className="hidden sm:inline">Enterprise AI Verification Platform. Verify <strong className="text-amber">text</strong>, <strong className="text-primary">images</strong>, <strong className="text-cyan">audio</strong>, and <strong className="text-secondary">video</strong> from a single platform — built for organizations that cannot afford to trust blindly.</span>
            </Reveal>

            {/* CTAs + Live demo (auth-dependent — client island) */}
            <HeroCTAButtons />

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-text-muted">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
                Trusted by examination offices, newsrooms, and legal teams
              </span>
              <span className="hidden md:inline text-border">|</span>
              <span className="hidden md:inline">Global Trust Verification</span>
            </div>

            <HeroScrollIndicator />
          </div>
        </section>

        {/* ── ENTERPRISE TRUST BANNER ── */}
        <ErrorBoundary>
          <EnterpriseTrustBanner />
        </ErrorBoundary>

        {/* ── WHO WE SERVE ── */}
        <ErrorBoundary>
          <WhoWeServeSection />
        </ErrorBoundary>

        {/* ══ STATS BAR ══ */}
        <section className="cv-auto py-12 sm:py-20 2xl:py-24 border-y border-border/20 bg-surface/20 relative [overflow:clip]">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.04) 0%, transparent 70%)' }} />
          <div className="max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto px-4 2xl:px-10 3xl:px-16 relative">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10 2xl:gap-14">
              {STATS.map((stat, i) => (
                <Reveal key={i} delay={i * 0.1} className="text-center">
                  <div className="text-[2.5rem] sm:text-5xl lg:text-6xl 2xl:text-7xl font-black mb-2 tabular-nums"
                    style={{ background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    <CountUp target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">{stat.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY CHOOSE AISCERN ── */}
        <ErrorBoundary>
          <WhyChooseSection />
        </ErrorBoundary>

        {/* ── HOW IT WORKS ── */}
        <ErrorBoundary>
          <HowItWorksSection />
        </ErrorBoundary>

        {/* ── INDUSTRY SOLUTIONS ── */}
        <ErrorBoundary>
          <IndustrySolutionsSection />
        </ErrorBoundary>

        {/* ── TECHNOLOGY ── */}
        <ErrorBoundary>
          <TechnologySection />
        </ErrorBoundary>

        {/* ── SECURITY ── */}
        <ErrorBoundary>
          <SecuritySection />
        </ErrorBoundary>

        {/* ── INTERACTIVE DEMO ── */}
        <ErrorBoundary>
          <InteractiveDemoSection />
        </ErrorBoundary>

        {/* ── STATISTICS ── */}
        <ErrorBoundary>
          <StatisticsSection />
        </ErrorBoundary>

        {/* ══ TOOLS GRID ══ */}
        <section id="tools" className="cv-auto py-24 md:py-32 px-4 sm:px-6 2xl:px-10 relative [overflow:clip]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.06) 0%, transparent 65%)' }} />

          <div className="max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto relative">
            <Reveal className="text-center mb-14 sm:mb-20">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/8 text-primary text-xs font-semibold mb-4">
                <Cpu className="w-3 h-3" /> Enterprise Verification Suite
              </div>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl 2xl:text-7xl font-black mb-4">
                Trust Verification <span className="gradient-text">Tools</span>
              </h2>
              <p className="text-text-muted text-base sm:text-lg 2xl:text-xl max-w-2xl 2xl:max-w-3xl mx-auto leading-relaxed">
                Multi-modal enterprise AI verification covering text, images, audio, and video. Every scan delivers forensic-grade authenticity scores in seconds.
              </p>
              <div className="mt-6 mx-auto h-px w-48 rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(37,99,235,0.6), transparent)' }} />
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 2xl:gap-6">
              {TOOLS.map((tool, i) => (
                <Reveal key={i} y={30} delay={i * 0.08} duration={0.5}>
                  <ToolLink href={tool.href} title={tool.label}>
                    <SpotlightCard color={`${tool.accent}28`}
                      className={`group tool-card relative overflow-hidden rounded-[24px] border ${tool.border} p-6 md:p-8 h-full cursor-pointer transition-all duration-300 bg-surface`}>
                      {/* Accent gradient overlay */}
                      <div className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ background: `linear-gradient(135deg, ${tool.accent}12 0%, ${tool.accent}05 40%, transparent 100%)` }} />
                      {/* Top accent band */}
                      <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl pointer-events-none"
                        style={{ background: `linear-gradient(90deg, transparent, ${tool.accent}80, transparent)` }} />
                      {/* Hover glow */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{ boxShadow: `0 0 32px ${tool.accent}22 inset, 0 0 0 1px ${tool.accent}30` }} />
                      {/* Scanline on hover */}
                      <div className="scanline" aria-hidden="true" />

                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-12 h-12 2xl:w-14 2xl:h-14 rounded-xl flex items-center justify-center ${tool.color} transition-transform duration-300 group-hover:scale-110`}
                          style={{ background: `${tool.accent}22`, border: `1px solid ${tool.accent}45` }}>
                          <tool.icon className="w-6 h-6 2xl:w-7 2xl:h-7" strokeWidth={1.8} />
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tool.color}`}
                          style={{ background: `${tool.accent}18`, border: `1px solid ${tool.accent}40` }}>
                          {tool.accuracy}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg 2xl:text-xl font-bold text-text-primary mb-2 group-hover:text-primary transition-colors duration-200 leading-tight">
                        {tool.label}
                      </h3>
                      <p className="text-sm 2xl:text-base text-text-muted leading-relaxed">{tool.desc}</p>

                      <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-text-muted group-hover:text-primary transition-colors duration-200">
                        Verify Now <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </SpotlightCard>
                  </ToolLink>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <ErrorBoundary>
          <TestimonialsSection />
        </ErrorBoundary>

        {/* ── FAQ ── */}
        <ErrorBoundary>
          <FAQSection />
        </ErrorBoundary>

        {/* ══ TRUST / FEATURES — bento grid ══ */}
        <section className="py-24 md:py-32 px-4 sm:px-6 2xl:px-10 border-t border-border/15 relative [overflow:clip]">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(37,99,235,0.03) 50%, transparent 100%)' }} />

          <div className="max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto relative">
            <Reveal className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald/20 bg-emerald/8 text-emerald text-xs font-semibold mb-4">
                <Shield className="w-3 h-3" /> Trust & Accuracy
              </div>
              <h2 className="text-3xl sm:text-5xl 2xl:text-6xl font-black text-text-primary">
                Built for forensic accuracy. <span className="gradient-text">Benchmarked on public verification datasets.</span>
              </h2>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 2xl:gap-6 mb-14">
              {TRUST_FEATURES.map(({ icon: Icon, color, bg, title, desc, large, stat, statSuffix, statLabel, accent }, idx) => {
                const isDataset  = title === 'Benchmarked Datasets'
                const accentHex  = accent ?? '#2563eb'
                return (
                <Reveal key={title} y={30} delay={idx * 0.1} duration={0.5}
                  className={large ? 'sm:col-span-2 lg:col-span-2' : ''}>
                  <SpotlightCard color={`${accentHex}22`}
                    className={`group relative h-full p-6 md:p-8 rounded-[24px] bg-surface bg-gradient-to-br ${bg} transition-all duration-300 ${large ? 'bento-shimmer' : ''} overflow-hidden`}>
                    {/* Accent border + top accent line */}
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{ boxShadow: `inset 0 0 0 1px ${accentHex}28` }} />
                    <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl pointer-events-none"
                      style={{ background: `linear-gradient(90deg, transparent, ${accentHex}70, transparent)` }} />
                    <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${color} group-hover:scale-110 transition-transform duration-300`}
                      style={{ background: `${accentHex}18`, border: `1px solid ${accentHex}38` }}>
                      <Icon className="w-5 h-5" strokeWidth={1.8} />
                    </div>
                    {stat !== undefined && (
                      isDataset ? (
                        <DatasetStatValue fallbackVal={stat} fallbackSuffix={statSuffix} fallbackLabel={statLabel} />
                      ) : (
                        <div className="mb-3">
                          <div className="text-3xl sm:text-4xl font-black tabular-nums"
                            style={{ background: 'linear-gradient(135deg, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            <CountUp target={parseFloat(stat) || 0} suffix={statSuffix} />
                          </div>
                          <div className="text-xs text-text-muted font-medium">{statLabel}</div>
                        </div>
                      )
                    )}
                    <h3 className="font-bold text-text-primary text-base mb-2">{title}</h3>
                    <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                  </SpotlightCard>
                </Reveal>
              )
              })}
            </div>

            {/* Professionals list */}
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-5">Trusted by professionals across</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {PROFESSIONALS.map(({ label, icon: Icon }) => (
                  <span key={label} className="prof-item inline-flex items-center gap-2 text-sm font-medium text-text-muted px-3.5 py-2 rounded-xl border border-border/60 bg-surface/30 cursor-default">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Methodology note */}
            <Reveal delay={0.2} className="max-w-2xl mx-auto text-center p-6 sm:p-8 rounded-2xl border border-border/50 bg-surface">
              <div className="flex items-center justify-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">How trust verification works</span>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">
                Every scan runs multiple independent AI verification models in parallel. Results are cross-validated into a single confidence score with forensic evidence — a clear AI or Human verdict in seconds.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══ PROFESSIONALS MARQUEE ══ */}
        <section className="py-10 sm:py-14 border-t border-border/15 [overflow:clip] relative">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(90deg, #08080d 0%, transparent 100%)' }} />
            <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(-90deg, #08080d 0%, transparent 100%)' }} />
            <div className="marquee-track marquee-left py-2">
              {[...PROFESSIONALS, ...PROFESSIONALS, ...PROFESSIONALS].map((prof, i) => (
                <div key={i} className="prof-item inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border/50 bg-surface/40 text-text-muted text-sm font-medium cursor-default mx-3 flex-shrink-0">
                  <prof.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                  {prof.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <ErrorBoundary>
          <FinalCTASection />
        </ErrorBoundary>

      </main>
      <SiteFooter />
    </div>
  )
}
