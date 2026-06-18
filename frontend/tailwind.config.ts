import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],

  safelist: [
    // Verdict color classes — used dynamically in detection results
    // FIXED: removed double-suffix bugs (text-rose-400-400 → text-rose-400, etc.)
    'text-rose-400',    'border-rose-500/30',    'bg-rose-500/10',
    'text-emerald-400', 'border-emerald-500/30', 'bg-emerald-500/10',
    'text-amber-400',   'border-amber-500/30',   'bg-amber-500/10',
    'text-blue-400',    'border-blue-500/30',    'bg-blue-500/10',
    'text-cyan-400',    'border-cyan-500/30',    'bg-cyan-500/10',
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
        // ── Semantic base (CSS-variable backed, full alpha support) ──────────────
        background: 'rgb(var(--color-background) / <alpha-value>)',

        // Surface scale — nested so bg-surface / bg-surface-elevated / bg-surface-hover
        // / bg-surface-border / bg-surface-active all resolve correctly
        surface: {
          DEFAULT:  'rgb(var(--color-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
          // hover/border intentionally use rgba — opacity is semantic, not a modifier
          hover:    'rgba(255, 255, 255, 0.04)',
          border:   'rgba(255, 255, 255, 0.08)',
          active:   'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },

        // Foreground scale
        foreground: {
          DEFAULT:   'rgb(var(--color-foreground) / <alpha-value>)',
          secondary: 'rgb(var(--color-foreground-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-foreground-muted) / <alpha-value>)',
          disabled:  'rgb(var(--color-foreground-disabled) / <alpha-value>)',
        },

        // ── Brand primary scale (blue) ────────────────────────────────────────
        primary: {
          DEFAULT: 'rgb(var(--color-primary-500) / <alpha-value>)',
          50:  'rgb(var(--color-primary-50)  / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          950: 'rgb(var(--color-primary-950) / <alpha-value>)',
        },

        // ── Accent scales ─────────────────────────────────────────────────────
        cyan: {
          DEFAULT: 'rgb(var(--color-cyan-500) / <alpha-value>)',
          300: 'rgb(var(--color-cyan-300) / <alpha-value>)',
          400: 'rgb(var(--color-cyan-400) / <alpha-value>)',
          500: 'rgb(var(--color-cyan-500) / <alpha-value>)',
          600: 'rgb(var(--color-cyan-600) / <alpha-value>)',
        },
        emerald: {
          DEFAULT: 'rgb(var(--color-emerald-500) / <alpha-value>)',
          400: 'rgb(var(--color-emerald-400) / <alpha-value>)',
          500: 'rgb(var(--color-emerald-500) / <alpha-value>)',
          600: 'rgb(var(--color-emerald-600) / <alpha-value>)',
        },
        amber: {
          DEFAULT: 'rgb(var(--color-amber-500) / <alpha-value>)',
          400: 'rgb(var(--color-amber-400) / <alpha-value>)',
          500: 'rgb(var(--color-amber-500) / <alpha-value>)',
          600: 'rgb(var(--color-amber-600) / <alpha-value>)',
        },
        rose: {
          DEFAULT: 'rgb(var(--color-rose-500) / <alpha-value>)',
          400: 'rgb(var(--color-rose-400) / <alpha-value>)',
          500: 'rgb(var(--color-rose-500) / <alpha-value>)',
          600: 'rgb(var(--color-rose-600) / <alpha-value>)',
        },

        // ── Legacy flat aliases (backwards compat — DO NOT REMOVE) ────────────
        // These map to the same CSS variables so old classes keep working
        border:           'rgba(255, 255, 255, 0.08)',
        'surface-border': 'rgba(255, 255, 255, 0.08)',
        'surface-hover':  'rgba(255, 255, 255, 0.04)',
        'surface-active': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        secondary:        'rgb(var(--color-primary-400) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-foreground-secondary) / <alpha-value>)',
        'text-muted':     'rgb(var(--color-foreground-muted) / <alpha-value>)',
        'text-disabled':  'rgb(var(--color-foreground-disabled) / <alpha-value>)',
        'text-blue-500':  'rgb(var(--color-foreground) / <alpha-value>)',
      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'], // headline font token
      },

      // ── Spacing ─────────────────────────────────────────────────────────────
      spacing: {
        'safe-top':    'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left':   'env(safe-area-inset-left)',
        'safe-right':  'env(safe-area-inset-right)',
      },

      // ── Backdrop blur extension ──────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },

      // ── Easing curves ────────────────────────────────────────────────────────
      transitionTimingFunction: {
        'ease-out-expo':     'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-spring':       'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-in-out-quint': 'cubic-bezier(0.86, 0, 0.07, 1)',
      },

      // ── Keyframes ────────────────────────────────────────────────────────────
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scan-sweep': {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { transform: 'translateY(200%)', opacity: '0' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        'spring': {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '60%':  { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fadeInUp': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fadeIn': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scaleIn': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'grid-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%':      { opacity: '0.5' },
        },
      },

      // ── Animations ───────────────────────────────────────────────────────────
      animation: {
        'fade-up':       'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in':       'fade-in 0.4s ease forwards',
        'scan-sweep':    'scan-sweep 2.4s ease-in-out infinite',
        'shimmer':       'shimmer 1.5s infinite',
        'pulse-glow':    'pulse-glow 2s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'spring':        'spring 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fadeInUp':      'fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fadeIn':        'fadeIn 0.4s ease forwards',
        'scaleIn':       'scaleIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'grid-pulse':    'grid-pulse 8s ease-in-out infinite',
      },

      // ── Shadows ──────────────────────────────────────────────────────────────
      boxShadow: {
        'glow':         '0 0 24px rgb(var(--color-primary-500) / 0.3)',
        'glow-lg':      '0 0 48px rgb(var(--color-primary-500) / 0.2)',
        'glow-primary': '0 0 24px rgb(var(--color-primary-500) / 0.3), 0 0 64px rgb(var(--color-primary-500) / 0.1)',
        'glow-cyan':    '0 0 24px rgb(var(--color-cyan-500) / 0.3), 0 0 64px rgb(var(--color-cyan-500) / 0.1)',
        'glow-emerald': '0 0 24px rgb(var(--color-emerald-500) / 0.3), 0 0 64px rgb(var(--color-emerald-500) / 0.1)',
      },

      // ── Background images ─────────────────────────────────────────────────────
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // Subtle SVG noise texture for depth — use as bg-noise on any panel
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
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
