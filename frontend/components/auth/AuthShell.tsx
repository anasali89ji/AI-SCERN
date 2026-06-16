/**
 * components/auth/AuthShell.tsx  — Module B.1
 *
 * Shared shell for sign-in and sign-up pages. Eliminates the ~95% duplication
 * between login/page.tsx and signup/page.tsx.
 *
 * B.3: Two-panel on lg+. Left panel has an on-brand "detection" visual and
 *      value-prop copy; right panel hosts the Clerk card.
 * B.2: Root has overflow-hidden; ambient bg divs are clipped; OTP fixed in
 *      clerkAppearance.ts.
 */
'use client'

import Image from 'next/image'
import Link  from 'next/link'
import { type ReactNode } from 'react'
import { ShieldCheck, Zap, Lock, ScanSearch, ImageIcon, FileAudio } from 'lucide-react'

interface AuthShellProps {
  title:        string
  subtitle:     string
  badge:        string
  /** Accent color for the animated badge dot: 'emerald' | 'blue' */
  badgeDotColor?: 'emerald' | 'blue'
  /** Extra visual treatment for left panel: subtle scan-line vs particle glow */
  variant?:     'signin' | 'signup'
  /** Clerk form (SignIn / SignUp component) */
  children:     ReactNode
  /** Optional footer below trust pills (e.g. terms line for signup) */
  extraFooter?: ReactNode
}

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Free forever' },
  { icon: Zap,         label: 'Instant results' },
  { icon: Lock,        label: 'No data stored' },
]

const FEATURES = [
  { icon: FileAudio,  label: 'AI Text Detection',    desc: '~94% accuracy — ChatGPT, Claude, Gemini' },
  { icon: ImageIcon,  label: 'Deepfake Images',      desc: '~97% accuracy — Midjourney, DALL·E, Flux' },
  { icon: ScanSearch, label: 'Voice Clone Detection', desc: '~91% accuracy — ElevenLabs, TTS, deepfakes' },
]

// Lightweight SVG scan-line animation for left panel (respects prefers-reduced-motion)
function ScanVisual({ variant }: { variant: 'signin' | 'signup' }) {
  const accent = variant === 'signup' ? '#3b82f6' : '#8b5cf6'
  return (
    <svg viewBox="0 0 300 220" className="w-full max-w-[280px] opacity-80" aria-hidden>
      {/* Grid */}
      <defs>
        <pattern id="auth-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3" />
        </pattern>
        <linearGradient id="scan-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0" />
          <stop offset="50%"  stopColor={accent} stopOpacity="0.6" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="300" height="220" fill="url(#auth-grid)" />
      <rect width="300" height="220" fill="url(#glow-a)" />

      {/* Document card */}
      <rect x="55" y="30" width="190" height="130" rx="12" fill="#0c0c20" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Text lines */}
      {[50, 62, 74, 86, 98, 110, 122, 134].map((y, i) => (
        <rect key={y} x="72" y={y} width={i % 3 === 2 ? 80 : 140} height="5" rx="2.5"
          fill={accent} fillOpacity={0.12 + (i * 0.04)} />
      ))}
      {/* AI badge overlay */}
      <rect x="165" y="105" width="62" height="22" rx="6" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1" strokeOpacity="0.6" />
      <text x="195" y="120" textAnchor="middle" fontSize="9" fontWeight="700" fill={accent} fillOpacity="0.9">AI DETECTED</text>

      {/* Scan line */}
      <rect x="55" y="0" width="190" height="3" fill="url(#scan-grad)" rx="1.5">
        <animateTransform attributeName="transform" type="translate" values="0,30;0,155;0,30"
          dur="3s" repeatCount="indefinite" calcMode="ease-in-out" />
      </rect>

      {/* Confidence ring bottom */}
      <circle cx="150" cy="192" r="18" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.2" />
      <circle cx="150" cy="192" r="18" fill="none" stroke={accent} strokeWidth="2"
        strokeDasharray={`${0.87 * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
        strokeDashoffset={`${0.25 * 2 * Math.PI * 18}`}
        transform="rotate(-90 150 192)" strokeOpacity="0.8" strokeLinecap="round" />
      <text x="150" y="196" textAnchor="middle" fontSize="8" fontWeight="700" fill={accent} fillOpacity="0.9">87%</text>
    </svg>
  )
}

export function AuthShell({
  title, subtitle, badge, badgeDotColor = 'emerald',
  variant = 'signin', children, extraFooter,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#050510] flex relative overflow-hidden">

      {/* ── Ambient background (clipped by overflow-hidden on parent) ─────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-1/3 w-[900px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.10) 0%, transparent 70%)' }} />
        {/* B.3: scan-line sweep replaces dot-grid — subtle, on-brand */}
        <div className="absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(37,99,235,0.04) 40px)', backgroundSize: '100% 40px' }} />
      </div>

      {/* ── LEFT PANEL (lg+) — brand/value-prop B.3 ────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] min-h-screen p-10 xl:p-14 relative z-10">
        <Link href="/" className="flex items-center gap-2.5 group w-fit">
          <Image src="/logo.png" alt="Aiscern logo" width={36} height={24}
            className="object-contain drop-shadow-[0_0_14px_rgba(245,100,0,0.6)] group-hover:drop-shadow-[0_0_20px_rgba(245,100,0,0.75)] transition-all duration-300" priority />
          <span className="text-xl font-black gradient-text tracking-tight">Aiscern</span>
        </Link>

        <div className="space-y-8">
          {/* Visual */}
          <div className="flex justify-start pl-2">
            <ScanVisual variant={variant} />
          </div>

          {/* Value-prop copy */}
          <div>
            <h2 className="text-2xl xl:text-3xl font-black text-white leading-tight mb-3">
              Free, multi-modal<br />AI content detection
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-6">
              Detect AI-generated text, images, audio, and video — instantly.
              No subscription, no hidden fees.
            </p>
            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-700">© 2026 Aiscern · Secured by Clerk</p>
      </div>

      {/* ── RIGHT PANEL — Clerk card ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative z-10 min-h-screen lg:min-h-0">

        {/* Logo on mobile (hidden on lg where left panel shows it) */}
        <Link href="/" className="flex items-center gap-2.5 mb-7 lg:hidden group">
          <Image src="/logo.png" alt="Aiscern logo" width={36} height={24}
            className="object-contain drop-shadow-[0_0_14px_rgba(245,100,0,0.6)] group-hover:drop-shadow-[0_0_20px_rgba(245,100,0,0.75)] transition-all duration-300" priority />
          <span className="text-xl font-black gradient-text tracking-tight">Aiscern</span>
        </Link>

        {/* Card container */}
        <div className="w-full max-w-[420px]">

          {/* Custom header */}
          <div className="bg-[#0c0c20] border-2 border-[#2f2f58] border-b-0 rounded-t-2xl px-6 sm:px-7 pt-7 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase text-blue-300 bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-full">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${badgeDotColor === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                {badge}
              </span>
            </div>
            <h1 className="text-white font-bold text-[22px] tracking-tight leading-tight">{title}</h1>
            <p className="text-slate-400 text-[13.5px] mt-1.5 leading-relaxed">{subtitle}</p>
          </div>

          {/* Clerk component (injected as children) */}
          {children}
        </div>

        {/* Trust pills */}
        <div className="flex items-center gap-2 sm:gap-3 mt-6 flex-wrap justify-center">
          {TRUST_PILLS.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full">
              <Icon className="w-3.5 h-3.5 text-primary" />
              {label}
            </span>
          ))}
        </div>

        {extraFooter}

        <p className="mt-4 text-[11px] text-slate-700 lg:hidden">© 2026 Aiscern · Secured by Clerk</p>
      </div>
    </div>
  )
}
