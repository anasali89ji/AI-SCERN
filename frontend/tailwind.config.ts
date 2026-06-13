import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Verdict color classes used dynamically in detection results
    'text-rose-400', 'border-rose-500/30', 'bg-rose-500/10',
    'text-emerald-400', 'border-emerald-500/30', 'bg-emerald-500/10',
    'text-amber-400', 'border-amber-500/30', 'bg-amber-500/10',
    'text-blue-400', 'border-blue-500/30', 'bg-blue-500/10',
    'text-cyan-400', 'border-cyan-500/30', 'bg-cyan-500/10',
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
        background:       '#08080d',
        surface:          '#0f0f17',
        'surface-active': '#141420',
        'surface-hover':  'rgba(255,255,255,0.04)',
        'surface-border': 'rgba(255,255,255,0.08)',
        border:           'rgba(255, 255, 255, 0.08)',
        'text-primary':   '#f1f5f9',
        'text-secondary': '#a0aec0',
        'text-muted':     '#94a3b8',
        'text-disabled':  '#64748b',
        primary:   'rgb(37 99 235 / <alpha-value>)',
        secondary: 'rgb(59 130 246 / <alpha-value>)',
        cyan:      'rgb(6 182 212 / <alpha-value>)',
        emerald:   'rgb(16 185 129 / <alpha-value>)',
        amber:     'rgb(245 158 11 / <alpha-value>)',
        rose:      'rgb(244 63 94 / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-top':    'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left':   'env(safe-area-inset-left)',
        'safe-right':  'env(safe-area-inset-right)',
      },
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
      },
      animation: {
        'fade-up':    'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in':    'fade-in 0.4s ease forwards',
        'scan-sweep': 'scan-sweep 2.4s ease-in-out infinite',
      },
      boxShadow: {
        'glow': '0 0 24px rgba(37, 99, 235, 0.3)',
        'glow-lg': '0 0 48px rgba(37, 99, 235, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

export default config
