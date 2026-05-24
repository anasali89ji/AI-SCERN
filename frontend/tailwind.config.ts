import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Verdict color classes
    'text-rose', 'border-rose', 'bg-rose',
    'text-emerald', 'border-emerald', 'bg-emerald',
    'text-amber', 'border-amber', 'bg-amber',
    'bg-primary', 'bg-secondary', 'bg-cyan',
    'border-rose/30', 'bg-rose/5',
    'border-emerald/30', 'bg-emerald/5',
    'border-amber/30', 'bg-amber/5',
    'bg-primary/10', 'bg-cyan/10', 'bg-emerald/10', 'bg-rose/10',
    'text-primary', 'text-cyan', 'text-emerald', 'text-rose',
    {
      pattern: /^(bg|border|text)-(primary|secondary|cyan|emerald|rose|amber)\/(5|8|10|12|14|18|25|28|30|60|80)$/,
    },
    // Gradient from/to/via opacity variants used in tool cards and trust section
    {
      pattern: /^(from|to|via)-(primary|secondary|cyan|emerald|rose|amber)\/(5|8|10|12|14|18|20|25|28|30|50|60|80)$/,
    },
    // Explicit from-*/8 and from-*/10 for tool cards
    'from-amber/8', 'from-primary/8', 'from-cyan/8',
    'from-secondary/8', 'from-emerald/8', 'from-rose/8',
    'from-amber/10', 'from-primary/10', 'from-cyan/10',
    'from-secondary/10', 'from-emerald/10', 'from-rose/10',
    'from-amber/20', 'from-cyan/20', 'from-emerald/20', 'from-rose/20',
    'from-amber/50', 'from-emerald/50', 'from-primary/5',
    'to-amber/5', 'to-cyan/5', 'to-emerald/5', 'to-rose/5', 'to-secondary/5',
    'via-secondary/5',
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
      opacity: {
        '8':  '0.08',
        '12': '0.12',
        '14': '0.14',
        '18': '0.18',
        '22': '0.22',
        '28': '0.28',
        '35': '0.35',
        '45': '0.45',
        '55': '0.55',
        '65': '0.65',
        '88': '0.88',
      },
      colors: {
        background:       '#08080d',
        surface:          '#0f0f17',
        'surface-active': '#141420',
        'surface-hover':  'rgba(255,255,255,0.04)',
        'surface-border': 'rgba(255,255,255,0.08)',
        border:           '#1c1c2e',
        'text-primary':   '#f1f5f9',
        'text-secondary': '#a0aec0',
        'text-muted':     '#718096',
        'text-disabled':  '#4a5568',
        primary:   'rgb(124 58 237 / <alpha-value>)',
        secondary: 'rgb(37 99 235 / <alpha-value>)',
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
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)' },
          '50%':       { boxShadow: '0 0 40px rgba(124, 58, 237, 0.6), 0 0 80px rgba(37, 99, 235, 0.2)' },
        },
        'scan-line': {
          '0%':   { top: '0%', opacity: '1' },
          '95%':  { top: '100%', opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'scan-sweep': {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { transform: 'translateY(200%)', opacity: '0' },
        },
        'mesh-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':       { transform: 'translate(40px, -30px) scale(1.08)' },
          '66%':       { transform: 'translate(-30px, 20px) scale(0.95)' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(32px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee-left': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'marquee-right': {
          from: { transform: 'translateX(-50%)' },
          to:   { transform: 'translateX(0)' },
        },
        'border-shimmer': {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'ping-slow': {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        'float':         'float 3s ease-in-out infinite',
        'glow-pulse':    'glow-pulse 2s ease-in-out infinite',
        'scan-line':     'scan-line 2s linear infinite',
        'scan-sweep':    'scan-sweep 2.4s ease-in-out infinite',
        'shimmer':       'shimmer 1.8s infinite linear',
        'mesh-drift':    'mesh-drift 18s ease-in-out infinite',
        'slide-up-fade': 'slide-up-fade 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'marquee-left':  'marquee-left 30s linear infinite',
        'marquee-right': 'marquee-right 35s linear infinite',
        'border-shimmer':'border-shimmer 6s linear infinite',
        'ping-slow':     'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      boxShadow: {
        'glow-purple': '0 0 24px rgba(139, 92, 246, 0.4)',
        'glow-purple-lg': '0 0 48px rgba(139, 92, 246, 0.3)',
        'glow-orange': '0 0 24px rgba(249, 115, 22, 0.4)',
        'inner-purple': 'inset 0 0 0 1px rgba(139, 92, 246, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-mesh': 'radial-gradient(ellipse at top left, rgba(139,92,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(37,99,235,0.1) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
}

export default config
