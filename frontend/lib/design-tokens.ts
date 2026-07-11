/**
 * Design Tokens
 * Single source of truth for values that must be shared between
 * TypeScript (runtime) and Tailwind (build time).
 *
 * ⚠️  DO NOT import Tailwind config here — this file is imported at runtime.
 *     For Tailwind utilities, use the class names directly (bg-surface, text-silver-900,
 *     etc. — see tailwind.config.ts). This file provides raw values for canvas drawing,
 *     chart/SVG math, Framer Motion variants, and any JS that needs literal color strings.
 *
 *     Values here MUST stay in sync with the `silver` / `accent` / `depth` / `modality`
 *     scales in tailwind.config.ts and the CSS custom properties in app/globals.css.
 */

export const tokens = {
  space: { section: 'clamp(4rem, 8vw, 8rem)', contentMax: '1280px', gutter: 'clamp(1rem, 4vw, 2rem)' },
  radius: { sm: '6px', md: '8px', lg: '12px', xl: '16px', pill: '9999px' },
  motion: { enter: 'cubic-bezier(0.16, 1, 0.3, 1)', exit: 'cubic-bezier(0.16, 1, 0.3, 1)', spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  surface: { base: '#141414', elevated: '#1A1A1A', deep: '#0A0A0A', overlay: 'rgba(10,10,10,0.8)' },
  border: { subtle: '1px solid rgba(255,255,255,0.06)', default: '1px solid #1E1E1E', strong: '1px solid #2A2A2A' },
  text: { primary: '#FFFFFF', secondary: '#E5E5E5', muted: '#A3A3A3', disabled: '#6B6B6B' },
  accent: { primary: '#2BEE34', hover: '#1A8F1F', glow: 'rgba(43, 238, 52, 0.15)', glowLg: 'rgba(43, 238, 52, 0.20)' },
  status: { error: '#FF4444', warning: '#FFB800', success: '#2BEE34' },
  modality: { text: '#f59e0b', image: '#2563eb', audio: '#06b6d4', video: '#8b5cf6' },
} as const

// ── Verdict color map — used in detection result rendering ───────────────────
export const verdictColors = {
  ai:        { text: '#FF4444', bg: 'rgba(255,68,68,0.08)',  border: 'rgba(255,68,68,0.20)' },
  human:     { text: '#2BEE34', bg: 'rgba(43,238,52,0.08)',  border: 'rgba(43,238,52,0.20)' },
  uncertain: { text: '#FFB800', bg: 'rgba(255,184,0,0.08)',  border: 'rgba(255,184,0,0.20)' },
  pending:   { text: tokens.text.muted, bg: 'rgba(163,163,163,0.08)', border: 'rgba(163,163,163,0.16)' },
} as const

export type VerdictKey = keyof typeof verdictColors

// ── Verdict → Tailwind class strings (for className= usage) ─────────────────
// NOTE: rose/emerald/amber are kept as the class names (matches tailwind safelist
// and existing detection-result components) even though the raw hex above uses the
// unified accent/status palette — the Tailwind rose-400/emerald-400/amber-400
// defaults render visually equivalent to status.error/success/warning.
export const verdictClasses = {
  ai:        { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30'    },
  human:     { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  uncertain: { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  pending:   { text: 'text-silver-600',  bg: 'bg-silver-400/10',  border: 'border-silver-400/20'  },
} as const

// ── Easing curves (for Framer Motion / CSS transitions) ─────────────────────
export const easing = {
  outExpo:    [0.16, 1, 0.3, 1]     as const,
  spring:     [0.34, 1.56, 0.64, 1] as const,
  inOutQuint: [0.86, 0, 0.07, 1]    as const,
} as const

// ── Animation durations (ms) ─────────────────────────────────────────────────
// Module 9.1: hover transitions must be >= 200ms ("duration-150 = fix").
export const duration = {
  fast:   200,
  normal: 300,
  slow:   400,
  verySlow: 600,
} as const

// ── Framer Motion variant presets ────────────────────────────────────────────
// `fadeIn` intentionally removed — banned generic entrance pattern (Module 0.1 / 9.1).
// Use `enter` for purposeful above-fold entrance motion instead.
export const motionVariants = {
  enter: {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easing.outExpo } },
  },
  scaleIn: {
    hidden:  { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: easing.outExpo } },
  },
  stagger: {
    // Module 9.1: stagger delay must stay between 0.04s and 0.08s.
    visible: { transition: { staggerChildren: 0.08 } },
  },
} as const

// ── Breakpoints (must match tailwind.config.ts screens) ─────────────────────
export const breakpoints = {
  xs:  375,
  sm:  640,
  md:  768,
  lg:  1024,
  xl:  1280,
  '2xl': 1440,
  '3xl': 1920,
} as const

export type Breakpoint = keyof typeof breakpoints

// ── Border radius ────────────────────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const

// ── Z-index scale ─────────────────────────────────────────────────────────────
export const zIndex = {
  base:    0,
  raised:  10,
  sticky:  40,
  overlay: 50,
  modal:   60,
  toast:   70,
} as const
