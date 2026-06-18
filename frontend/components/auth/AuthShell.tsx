/**
 * components/auth/AuthShell.tsx — v4
 *
 * Mobile-first two-panel auth layout.
 *
 * Mobile  (<lg): Full-viewport centered card. Logo above, copyright below.
 * Desktop (lg+): Left brand panel (42 %) + right card panel (58 %).
 *
 * Design rules enforced here:
 *  - One unified card border — no split-border join hack.
 *  - Single background gradient; no competing blobs.
 *  - Left panel hero is a real-looking product mockup, not abstract SVG.
 *  - No "trust pills" below the card — they read as landing-page filler.
 *  - Every measurement is on the 4 px sub-grid or 8 px grid.
 */
'use client'

import Image              from 'next/image'
import Link               from 'next/link'
import { type ReactNode } from 'react'
import {
  FileText, ImageIcon, Mic,
  ShieldCheck, Lock, Zap,
} from 'lucide-react'

/* ── Props ──────────────────────────────────────────────────────────────────── */
interface AuthShellProps {
  mode:        'signin' | 'signup'
  children:    ReactNode
  extraFooter?: ReactNode
}

/* ── Left panel — product mockup ─────────────────────────────────────────────
 *
 * Renders a faithful mini-replica of an actual Aiscern scan result.
 * Shows text analysis so the value prop is immediately clear.
 */
function DetectionMockup() {
  const bars: [string, number, string][] = [
    ['ChatGPT-4o', 71, '#10a37f'],
    ['Claude 3',   44, '#cc785c'],
    ['Gemini Pro', 33, '#4285f4'],
  ]

  return (
    <div
      className="w-full max-w-[308px] rounded-2xl overflow-hidden text-left"
      style={{
        background:  '#06061a',
        border:      '1px solid #181840',
        boxShadow:   '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(37,99,235,0.06)',
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-3 px-4 py-[11px]"
        style={{ borderBottom: '1px solid #101030', background: '#04040f' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <span
          className="flex-1 text-center text-[10.5px] font-medium"
          style={{ color: '#3a3a60' }}
        >
          aiscern.com — Text Analysis
        </span>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(16,163,127,0.12)', border: '1px solid rgba(16,163,127,0.25)' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#10a37f' }}
          />
          <span className="text-[9.5px] font-semibold" style={{ color: '#10a37f' }}>
            Live
          </span>
        </div>
      </div>

      {/* Text sample */}
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #0d0d2a' }}>
        <p className="text-[11.5px] leading-[1.75]" style={{ color: '#4a4a72' }}>
          <span style={{ color: '#9898c8' }}>
            "The rapid advancement of artificial intelligence
          </span>{' '}
          has transformed how we create and distribute information,
          enabling machines to produce text that is increasingly...
          <span
            className="inline-block w-[2px] h-[14px] ml-[1px] align-middle animate-pulse"
            style={{ background: '#2563eb' }}
          />
          "
        </p>
      </div>

      {/* AI probability */}
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #0d0d2a' }}>
        <div className="flex items-baseline justify-between mb-2.5">
          <span
            className="text-[10px] font-semibold tracking-[0.09em] uppercase"
            style={{ color: '#3a3a62' }}
          >
            AI probability
          </span>
          <span className="text-[15px] font-bold tabular-nums" style={{ color: '#fb7185' }}>
            94.2%
          </span>
        </div>
        <div
          className="h-[5px] w-full rounded-full overflow-hidden"
          style={{ background: '#0e0e28' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width:      '94.2%',
              background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 60%, #fb7185 100%)',
            }}
          />
        </div>
      </div>

      {/* Model breakdown */}
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #0d0d2a' }}>
        <span
          className="text-[10px] font-semibold tracking-[0.09em] uppercase block mb-2.5"
          style={{ color: '#3a3a62' }}
        >
          Model attribution
        </span>
        <div className="space-y-2">
          {bars.map(([model, pct, color]) => (
            <div key={model} className="flex items-center gap-2.5">
              <span
                className="text-[10.5px] w-[70px] flex-shrink-0 font-medium"
                style={{ color: '#5a5a88' }}
              >
                {model}
              </span>
              <div
                className="flex-1 h-[4px] rounded-full overflow-hidden"
                style={{ background: '#0e0e28' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color + 'bb' }}
                />
              </div>
              <span
                className="text-[10px] font-semibold w-6 text-right tabular-nums flex-shrink-0"
                style={{ color: '#5a5a88' }}
              >
                {pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Verdict */}
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ background: 'rgba(251,113,133,0.05)' }}
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(251,113,133,0.15)', border: '1px solid rgba(251,113,133,0.3)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fb7185' }} />
        </div>
        <div>
          <p className="text-[10.5px] font-semibold" style={{ color: '#fb7185' }}>
            AI-Generated Content Detected
          </p>
          <p className="text-[9.5px] mt-[1px]" style={{ color: '#4a4a72' }}>
            High confidence · 3 models agree
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Feature row ─────────────────────────────────────────────────────────────
 * Clean 3-item list. No progress bars, no competing numbers.
 * Just icon + label + description.
 */
const FEATURES = [
  {
    icon:  FileText,
    label: 'AI Text Detection',
    desc:  'ChatGPT · Claude · Gemini · Llama',
  },
  {
    icon:  ImageIcon,
    label: 'Deepfake Images',
    desc:  'Midjourney · DALL·E · Stable Diffusion',
  },
  {
    icon:  Mic,
    label: 'Voice Clone Detection',
    desc:  'ElevenLabs · PlayHT · TTS',
  },
]

/* ── Shell ───────────────────────────────────────────────────────────────────*/
export function AuthShell({ mode, children, extraFooter }: AuthShellProps) {
  return (
    <div
      className="min-h-screen flex relative overflow-x-hidden"
      style={{ background: '#04040f' }}
    >

      {/* ── Background — one gradient, nothing more ───────────────── */}
      <div
        className="pointer-events-none select-none absolute inset-0"
        aria-hidden
      >
        <div
          className="absolute"
          style={{
            top:       '-10%',
            left:      '38%',
            width:     '70vw',
            height:    '80vh',
            background:'radial-gradient(ellipse at center, rgba(37,99,235,0.07) 0%, transparent 65%)',
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
           LEFT PANEL — desktop only
      ══════════════════════════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col justify-between relative z-10"
        style={{
          width:         '42%',
          minHeight:     '100vh',
          padding:       '40px 48px 36px',
          borderRight:   '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 w-fit group">
          <Image
            src="/logo.png"
            alt="Aiscern"
            width={32}
            height={20}
            priority
            className="object-contain"
            style={{
              filter:     'drop-shadow(0 0 10px rgba(245,100,0,0.5))',
              transition: 'filter 0.3s',
            }}
          />
          <span
            className="text-[17px] font-black tracking-tight gradient-text"
          >
            Aiscern
          </span>
        </Link>

        {/* Centre — headline + mockup + features */}
        <div style={{ marginTop: '-32px' }}>
          <h2
            className="font-black text-white leading-[1.15] mb-3"
            style={{ fontSize: '26px', letterSpacing: '-0.02em' }}
          >
            Detect AI content<br />in seconds. Free.
          </h2>
          <p
            className="mb-8 leading-relaxed"
            style={{ color: '#4a4a72', fontSize: '13.5px', maxWidth: '300px' }}
          >
            Multi-modal AI detection across text, images, audio, and video.
            No subscription. No hidden fees.
          </p>

          {/* Product mockup */}
          <div className="mb-8">
            <DetectionMockup />
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width:      '32px',
                    height:     '32px',
                    borderRadius:'8px',
                    background: 'rgba(37,99,235,0.08)',
                    border:     '1px solid rgba(37,99,235,0.15)',
                  }}
                >
                  <Icon size={14} color="#4b82f7" />
                </div>
                <div>
                  <p
                    className="font-semibold leading-none"
                    style={{ color: '#c8d0f0', fontSize: '13px' }}
                  >
                    {label}
                  </p>
                  <p
                    style={{ color: '#3e3e62', fontSize: '11.5px', marginTop: '3px' }}
                  >
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ color: '#26264a', fontSize: '11px' }}>
          © 2026 Aiscern. All rights reserved.
        </p>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
           RIGHT PANEL — card (all viewports)
      ══════════════════════════════════════════════════════════════ */}
      <main
        className="flex-1 flex flex-col items-center justify-center relative z-10"
        style={{ padding: '24px 16px 32px' }}
      >

        {/* Mobile logo — hidden on desktop where left panel has it */}
        <Link
          href="/"
          className="flex items-center gap-2.5 lg:hidden mb-8"
          style={{ marginBottom: '28px' }}
        >
          <Image
            src="/logo.png"
            alt="Aiscern"
            width={32}
            height={20}
            priority
            className="object-contain"
            style={{ filter: 'drop-shadow(0 0 10px rgba(245,100,0,0.5))' }}
          />
          <span className="text-[17px] font-black tracking-tight gradient-text">
            Aiscern
          </span>
        </Link>

        {/* ── Auth card ──────────────────────────────────────────── */}
        <div className="w-full" style={{ maxWidth: '408px' }}>

          {/* Card frame — single unified border */}
          <div
            style={{
              background:   '#06061a',
              border:       '1px solid #14143a',
              borderRadius: '20px',
              overflow:     'hidden',
              boxShadow: [
                '0 0 0 1px rgba(37,99,235,0.05)',
                '0 20px 60px rgba(0,0,0,0.6)',
                '0 4px 16px rgba(0,0,0,0.4)',
              ].join(', '),
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding:       '28px 32px 24px',
                borderBottom:  '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {mode === 'signin' ? (
                <>
                  <p
                    className="font-black text-white leading-none"
                    style={{ fontSize: '22px', letterSpacing: '-0.025em', marginBottom: '7px' }}
                  >
                    Welcome back
                  </p>
                  <p style={{ color: '#3e3e6e', fontSize: '13.5px', lineHeight: 1.5 }}>
                    Sign in to your Aiscern account to continue
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="font-black text-white leading-none"
                    style={{ fontSize: '22px', letterSpacing: '-0.025em', marginBottom: '7px' }}
                  >
                    Create your account
                  </p>
                  <p style={{ color: '#3e3e6e', fontSize: '13.5px', lineHeight: 1.5 }}>
                    Free forever — no credit card needed
                  </p>
                </>
              )}
            </div>

            {/* Clerk form — card bg is transparent so this matches */}
            <div style={{ background: '#06061a' }}>
              {children}
            </div>
          </div>

          {/* Security note — minimal, no visual noise */}
          <div
            className="flex items-center justify-center gap-4 mt-5"
          >
            {[
              { icon: ShieldCheck, label: 'Secured by Clerk' },
              { icon: Lock,        label: 'End-to-end encrypted' },
              { icon: Zap,         label: 'No data stored' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5"
                style={{ color: '#26264a', fontSize: '11px' }}
              >
                <Icon size={11} />
                {label}
              </span>
            ))}
          </div>

          {extraFooter}
        </div>

        <p
          className="lg:hidden mt-6"
          style={{ color: '#1c1c3a', fontSize: '11px' }}
        >
          © 2026 Aiscern
        </p>
      </main>
    </div>
  )
}
