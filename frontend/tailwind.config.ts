import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],

  safelist: [
    // Verdict color classes — used dynamically in detection results
    'text-rose-400',    'border-rose-500/30',    'bg-rose-500/10',
    'text-emerald-400', 'border-emerald-500/30', 'bg-emerald-500/10',
    'text-amber-400',   'border-amber-500/30',   'bg-amber-500/10',
    // Moss accent dynamic classes
    'text-moss-300', 'bg-moss-300/10', 'border-moss-300/20',
    'bg-moss-300/20', 'text-moss-200',
  ],

  darkMode: 'class',

  theme: {
    screens: {
      'xs':  '375px',
      'sm':  '640px',
      'md':  '768px',
      'lg':  '1024px',
      'xl':  '1280px',
      '2xl': '1440px',
      '3xl': '1920px',
    },
    extend: {
      colors: {
        // ── Silver scale (backgrounds, surfaces, borders) ──────────────────────
        silver: {
          50:  '#0A0A0A',  // deepest black, hero overlays
          100: '#141414',  // primary background
          200: '#1A1A1A',  // elevated surfaces, hover states
          300: '#1E1E1E',  // borders, dividers
          400: '#2A2A2A',  // input fields
          500: '#3A3A3A',  // disabled states
          600: '#6B6B6B',  // disabled text
          700: '#A3A3A3',  // muted text
          800: '#E5E5E5',  // secondary text
          900: '#FFFFFF',  // primary text
        },

        // ── Luminous Moss scale (accent / CTA) ────────────────────────────────
        moss: {
          400: '#147A18',  // deep hover
          300: '#2BEE34',  // primary accent
          200: '#4FFF58',  // glows, focus rings
          100: '#8BFF8F',  // pale highlights
          50:  '#E6FFE8',  // tinted bg, success messages
        },

        // ── Semantic aliases (for readable class names) ────────────────────────
        background: '#141414',
        surface: {
          DEFAULT:  '#141414',
          elevated: '#1A1A1A',
          deep:     '#0A0A0A',
        },
        border: {
          DEFAULT: '#1E1E1E',
          subtle:  '#1E1E1E',
          strong:  '#2A2A2A',
        },
        accent: {
          DEFAULT: '#2BEE34',
          hover:   '#1A8F1F',
          glow:    'rgba(43, 238, 52, 0.15)',
        },

        // ── Status colors (kept for detection results) ─────────────────────────
        error:   '#FF4444',
        warning: '#FFB800',

        // ── Depth layers — special overlay panels ONLY. Do not mix with `silver`
        //    on the same surface type (see Module 0.1 token-consistency rule).
        depth: {
          bg:       '#0A0A0A',
          surface:  '#141414',
          elevated: '#1A1A1A',
          floating: '#1E1E1E',
        },

        // ── Per-modality accents (v5.0 plan) ────────────────────────────────────
        modality: {
          text:  '#f59e0b', // amber
          image: '#2563eb', // blue
          audio: '#06b6d4', // cyan
          video: '#8b5cf6', // violet
        },

        // ── Legacy compatibility alias — kept (not deleted) because button.tsx,
        //    badge.tsx, tabs.tsx, accordion.tsx, dialog.tsx, dropdown-menu.tsx
        //    reference primary-400/500/600 directly. Values equal `accent` so
        //    there is no visual duplication, just a second name for the same color.
        primary: {
          400:     '#4FFF58',
          500:     '#2BEE34',
          600:     '#1A8F1F',
          DEFAULT: '#2BEE34',
        },
      },

      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        heading: ['var(--font-geist-sans)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
        display: ['var(--font-geist-sans)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // ── Fluid scale (Module 0.1) — use these instead of arbitrary text-[...] values
        'display':  ['clamp(3rem, 8vw, 6rem)',      { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline': ['clamp(2rem, 5vw, 3.5rem)',     { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '600' }],
        'lead':     ['clamp(1.125rem, 1.5vw, 1.25rem)', { lineHeight: '1.6', fontWeight: '400' }],
        // ── Legacy fixed sizes — kept so existing usages don't 404, prefer fluid scale above
        'hero': ['clamp(48px,6vw,64px)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2':   ['clamp(32px,4vw,40px)', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3':   ['clamp(24px,3vw,28px)', { lineHeight: '1.3', fontWeight: '600' }],
      },

      spacing: {
        'safe-top':    'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left':   'env(safe-area-inset-left)',
        'safe-right':  'env(safe-area-inset-right)',
      },

      borderRadius: {
        'sm':  '6px',
        'md':  '8px',
        'lg':  '12px',
        'xl':  '16px',
        '2xl': '20px',
      },

      boxShadow: {
        'card':    '0 4px 24px rgba(0, 0, 0, 0.4)',
        'glow':    '0 0 20px rgba(43, 238, 52, 0.15)',
        'glow-lg': '0 0 40px rgba(43, 238, 52, 0.20)',
        'deep':    '0 8px 40px rgba(0, 0, 0, 0.6)',
        'ambient': '0 2px 8px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)',
        'lift':    '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      },

      keyframes: {
        // NOTE: generic `fade-in` / `slide-up` keyframes removed from the animation
        // registry below per the vibecode ban (Module 0.1). Keyframes stay defined
        // here only so any lingering `animate-fade-in` class doesn't hard-404 while
        // call sites are migrated to `animate-enter`; do not reference them in new code.
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'enter': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'exit': {
          '0%':   { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        // Keep scan-sweep for detection loading states
        'scan-sweep': {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { transform: 'translateY(200%)', opacity: '0' },
        },
        'stagger-in': {
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },

      animation: {
        // 'fade-in' / 'slide-up' intentionally NOT registered here — banned generic
        // entrance patterns (Module 0.1). Use 'enter' for purposeful entrance motion.
        'enter':       'enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'exit':        'exit 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in':    'scale-in 150ms ease-out',
        'spin-slow':   'spin 1s linear infinite',
        'pulse-slow':  'pulse-subtle 2s ease-in-out infinite',
        'scan-sweep':  'scan-sweep 2.4s ease-in-out infinite',
        'stagger-in':  'stagger-in 0.5s var(--ease-smooth) forwards',
        'shimmer':     'shimmer 1.5s infinite',
      },

      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring':        'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':        'cubic-bezier(0.22, 1, 0.36, 1)',
        'dramatic':      'cubic-bezier(0.87, 0, 0.13, 1)',
      },
    },
  },

  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
  ],
}

export default config
