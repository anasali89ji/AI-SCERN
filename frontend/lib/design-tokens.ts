/**
 * Design Tokens
 * Single source of truth for values that must be shared between
 * TypeScript (runtime) and Tailwind (build time).
 *
 * ⚠️  DO NOT import Tailwind config here — this file is imported at runtime.
 *     For Tailwind utilities, use the class names directly.
 *     This file provides token values for canvas drawing, chart libraries,
 *     Framer Motion variants, and any JS that needs raw color values.
 */

// ── Color values (must match tailwind.config.ts CSS variable channel values) ─
export const colors = {
  // Surfaces
  background:      'rgb(8 8 13)',
  surface:         'rgb(15 15 23)',
  surfaceElevated: 'rgb(20 20 32)',
  surfaceHover:    'rgba(255, 255, 255, 0.04)',
  surfaceBorder:   'rgba(255, 255, 255, 0.08)',

  // Foreground
  foreground:          'rgb(241 245 249)',
  foregroundSecondary: 'rgb(160 174 192)',
  foregroundMuted:     'rgb(148 163 184)',
  foregroundDisabled:  'rgb(100 116 139)',

  // Primary (blue) — most-used stops
  primary: {
    50:  'rgb(239 246 255)',
    100: 'rgb(219 234 254)',
    200: 'rgb(191 219 254)',
    300: 'rgb(147 197 253)',
    400: 'rgb(96 165 250)',
    500: 'rgb(37 99 235)',
    600: 'rgb(29 78 216)',
    700: 'rgb(30 64 175)',
    800: 'rgb(30 58 138)',
    900: 'rgb(23 37 84)',
    950: 'rgb(15 23 42)',
  },

  // Accent stops (most-used)
  cyan:    { 300: 'rgb(103 232 249)', 400: 'rgb(34 211 238)', 500: 'rgb(6 182 212)',   600: 'rgb(8 145 178)'  },
  emerald: { 400: 'rgb(52 211 153)',  500: 'rgb(16 185 129)', 600: 'rgb(5 150 105)'   },
  amber:   { 400: 'rgb(251 191 36)',  500: 'rgb(245 158 11)', 600: 'rgb(217 119 6)'   },
  rose:    { 400: 'rgb(251 113 133)', 500: 'rgb(244 63 94)',  600: 'rgb(225 29 72)'   },
} as const

// ── Verdict color map — used in detection result rendering ───────────────────
export const verdictColors = {
  ai:        { text: colors.rose[400],    bg: 'rgba(244,63,94,0.10)',   border: 'rgba(244,63,94,0.18)' },
  human:     { text: colors.emerald[400], bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.18)' },
  uncertain: { text: colors.amber[400],   bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.18)' },
  pending:   { text: colors.primary[400], bg: 'rgba(37,99,235,0.10)',   border: 'rgba(37,99,235,0.18)' },
} as const

export type VerdictKey = keyof typeof verdictColors

// ── Verdict → Tailwind class strings (for className= usage) ─────────────────
export const verdictClasses = {
  ai:        { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30'    },
  human:     { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  uncertain: { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  pending:   { text: 'text-primary-400', bg: 'bg-primary-500/10', border: 'border-primary-500/20' },
} as const

// ── Easing curves (for Framer Motion / CSS transitions) ─────────────────────
export const easing = {
  outExpo:    [0.16, 1, 0.3, 1]    as const,
  spring:     [0.34, 1.56, 0.64, 1] as const,
  inOutQuint: [0.86, 0, 0.07, 1]   as const,
} as const

// ── Animation durations (ms) ─────────────────────────────────────────────────
export const duration = {
  fast:   150,
  normal: 250,
  slow:   400,
  verySlow: 600,
} as const

// ── Framer Motion variant presets ────────────────────────────────────────────
export const motionVariants = {
  fadeUp: {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easing.outExpo } },
  },
  fadeIn: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  },
  scaleIn: {
    hidden:  { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: easing.outExpo } },
  },
  stagger: {
    visible: { transition: { staggerChildren: 0.07 } },
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
  md: 10,
  lg: 14,
  xl: 20,
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
