/**
 * components/auth/AuthShell.tsx
 *
 * Redesigned two-panel auth shell.
 * Left: brand/value-prop panel (lg+).
 * Right: seamless Clerk card with a unified border — one outer frame,
 *        Clerk fills the body. No split-border hack that caused broken edges.
 */
'use client'

import Image from 'next/image'
import Link  from 'next/link'
import { type ReactNode } from 'react'
import { ShieldCheck, Zap, Lock, ScanSearch, ImageIcon, FileAudio, Star } from 'lucide-react'

interface AuthShellProps {
  title:          string
  subtitle:       string
  badge:          string
  badgeDotColor?: 'emerald' | 'blue'
  variant?:       'signin' | 'signup'
  children:       ReactNode
  extraFooter?:   ReactNode
}

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Free forever'    },
  { icon: Zap,         label: 'Instant results' },
  { icon: Lock,        label: 'No data stored'  },
]

const FEATURES = [
  {
    icon:  FileAudio,
    label: 'AI Text Detection',
    desc:  '~94% accuracy — ChatGPT, Claude, Gemini',
    pct:   94,
  },
  {
    icon:  ImageIcon,
    label: 'Deepfake Images',
    desc:  '~97% accuracy — Midjourney, DALL·E, Flux',
    pct:   97,
  },
  {
    icon:  ScanSearch,
    label: 'Voice Clone Detection',
    desc:  '~91% accuracy — ElevenLabs, TTS',
    pct:   91,
  },
]

const STATS = [
  { value: '2M+',  label: 'Scans run'     },
  { value: '95%',  label: 'Avg accuracy'  },
  { value: '100%', label: 'Free forever'  },
]

/** Minimal animated scan visual */
function ScanVisual({ variant }: { variant: 'signin' | 'signup' }) {
  const accent = variant === 'signup' ? '#3b82f6' : '#8b5cf6'
  const glow   = variant === 'signup' ? 'rgba(59,130,246,0.18)' : 'rgba(139,92,246,0.18)'

  return (
    <svg viewBox="0 0 320 200" className="w-full max-w-[300px]" aria-hidden>
      <defs>
        <pattern id={`ag-${variant}`} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0L0 0 0 28" fill="none" stroke={accent} strokeWidth="0.35" strokeOpacity="0.22" />
        </pattern>
        <linearGradient id={`sg-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0" />
          <stop offset="45%"  stopColor={accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`gg-${variant}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0"    />
        </radialGradient>
        <filter id={`bl-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="320" height="200" fill={`url(#ag-${variant})`} />
      <rect width="320" height="200" fill={`url(#gg-${variant})`} />

      {/* Glow blob */}
      <ellipse cx="160" cy="100" rx="90" ry="60" fill={glow} filter={`url(#bl-${variant})`} />

      {/* Document card */}
      <rect x="60" y="22" width="200" height="130" rx="10"
        fill="#080818" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45" />

      {/* Text lines */}
      {[40, 54, 68, 82, 96, 110, 124].map((y, i) => (
        <rect key={y} x="76" y={y} width={i % 3 === 2 ? 70 : i % 3 === 1 ? 130 : 150}
          height="5" rx="2.5" fill={accent} fillOpacity={0.1 + i * 0.035} />
      ))}

      {/* AI badge */}
      <rect x="168" y="98" width="68" height="20" rx="5"
        fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="0.8" strokeOpacity="0.6" />
      <text x="202" y="112" textAnchor="middle" fontSize="8.5" fontWeight="700"
        fill={accent} fillOpacity="0.95">AI DETECTED</text>

      {/* Scan line */}
      <rect x="60" y="0" width="200" height="2.5" fill={`url(#sg-${variant})`} rx="1.5">
        <animateTransform attributeName="transform" type="translate"
          values="0,22;0,147;0,22" dur="3.2s" repeatCount="indefinite" calcMode="ease-in-out" />
      </rect>

      {/* Corner accents */}
      {/* TL */}
      <path d="M60,34 L60,22 L72,22" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.7" />
      {/* TR */}
      <path d="M248,34 L260,34 L260,22 L248,22" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.7" />
      {/* BL */}
      <path d="M60,140 L60,152 L72,152" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.7" />
      {/* BR */}
      <path d="M248,140 L260,140 L260,152 L248,152" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.7" />

      {/* Confidence arc */}
      <circle cx="160" cy="182" r="14" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.18" />
      <circle cx="160" cy="182" r="14" fill="none" stroke={accent} strokeWidth="1.5"
        strokeDasharray={`${0.88 * 2 * Math.PI * 14} ${2 * Math.PI * 14}`}
        strokeDashoffset={`${0.25 * 2 * Math.PI * 14}`}
        transform="rotate(-90 160 182)" strokeOpacity="0.85" strokeLinecap="round" />
      <text x="160" y="186" textAnchor="middle" fontSize="7.5" fontWeight="700"
        fill={accent} fillOpacity="0.95">88%</text>
    </svg>
  )
}

export function AuthShell({
  title, subtitle, badge, badgeDotColor = 'emerald',
  variant = 'signin', children, extraFooter,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#050510] flex relative overflow-hidden">

      {/* ── Ambient background ──────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <div className="absolute top-[-20%] left-[30%] w-[800px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, transparent 68%)' }} />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.09) 0%, transparent 68%)' }} />
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(37,99,235,0.03) 40px)',
            backgroundSize:  '100% 40px',
          }} />
      </div>

      {/* ── LEFT PANEL (lg+) ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] min-h-screen px-10 xl:px-14 py-10 relative z-10">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group w-fit">
          <Image src="/logo.png" alt="Aiscern" width={34} height={22}
            className="object-contain drop-shadow-[0_0_12px_rgba(245,100,0,0.55)] group-hover:drop-shadow-[0_0_18px_rgba(245,100,0,0.7)] transition-all duration-300"
            priority />
          <span className="text-[19px] font-black gradient-text tracking-tight">Aiscern</span>
        </Link>

        {/* Middle content */}
        <div className="space-y-9">
          <div className="flex justify-start">
            <ScanVisual variant={variant} />
          </div>

          <div>
            <h2 className="text-[26px] xl:text-[30px] font-black text-white leading-[1.18] mb-3">
              Free, multi-modal<br />AI content detection
            </h2>
            <p className="text-slate-400 text-[13.5px] leading-relaxed max-w-[300px] mb-7">
              Detect AI-generated text, images, audio, and video in seconds.
              No subscription. No hidden fees. Ever.
            </p>

            {/* Stats row */}
            <div className="flex gap-5 mb-7">
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <p className="text-white font-black text-[20px] leading-none">{value}</p>
                  <p className="text-slate-500 text-[11px] mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Feature list */}
            <div className="space-y-3.5">
              {FEATURES.map(({ icon: Icon, label, desc, pct }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20
                    flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-white/90 truncate">{label}</p>
                      <span className="text-[11px] font-bold text-primary/80 flex-shrink-0">{pct}%</span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-700">© 2026 Aiscern · Secured by Clerk</p>
      </div>

      {/* ── RIGHT PANEL — auth card ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10">

        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-2.5 mb-8 lg:hidden group">
          <Image src="/logo.png" alt="Aiscern" width={34} height={22}
            className="object-contain drop-shadow-[0_0_12px_rgba(245,100,0,0.55)] group-hover:drop-shadow-[0_0_18px_rgba(245,100,0,0.7)] transition-all duration-300"
            priority />
          <span className="text-[19px] font-black gradient-text tracking-tight">Aiscern</span>
        </Link>

        {/* Unified card */}
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-[#1e1e42] bg-[#080818] shadow-[0_24px_64px_rgba(0,0,0,0.75)] overflow-hidden">

            {/* Card header */}
            <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-[#141432]">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.1em]
                  uppercase text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    badgeDotColor === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'
                  }`} />
                  {badge}
                </span>
              </div>

              <h1 className="text-white font-bold text-[21px] tracking-tight leading-tight">{title}</h1>
              <p className="text-slate-400 text-[13px] mt-1.5 leading-relaxed">{subtitle}</p>
            </div>

            {/* Clerk form renders here — card bg is transparent in clerkAppearance */}
            <div className="bg-[#080818]">
              {children}
            </div>
          </div>

          {/* Trust pills */}
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            {TRUST_PILLS.map(({ icon: Icon, label }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium
                  text-slate-500 bg-white/[0.03] border border-white/[0.06]
                  px-2.5 py-1.5 rounded-full">
                <Icon className="w-3 h-3 text-slate-500" />
                {label}
              </span>
            ))}
          </div>

          {extraFooter}
        </div>

        <p className="mt-6 text-[11px] text-slate-700 lg:hidden">© 2026 Aiscern · Secured by Clerk</p>
      </div>
    </div>
  )
}
