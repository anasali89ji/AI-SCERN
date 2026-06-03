import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '375px', sm: '640px', md: '768px',
      lg: '1024px', xl: '1280px', '2xl': '1440px',
    },
    extend: {
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
        primary:          'rgb(37 99 235)',
        secondary:        'rgb(59 130 246)',
        cyan:             'rgb(6 182 212)',
        emerald:          'rgb(16 185 129)',
        amber:            'rgb(245 158 11)',
        rose:             'rgb(244 63 94)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue':    '0 0 24px rgba(37, 99, 235, 0.4)',
        'glow-blue-lg': '0 0 48px rgba(37, 99, 235, 0.3)',
        'glow-cyan':    '0 0 24px rgba(6, 182, 212, 0.4)',
        'inner-blue':   'inset 0 0 0 1px rgba(37, 99, 235, 0.3)',
      },
      keyframes: {
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(32px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition:  '400px 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)' },
          '50%':       { boxShadow: '0 0 40px rgba(37, 99, 235, 0.6), 0 0 80px rgba(6, 182, 212, 0.2)' },
        },
        'mesh-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':       { transform: 'translate(40px, -30px) scale(1.08)' },
          '66%':       { transform: 'translate(-30px, 20px) scale(0.95)' },
        },
      },
      animation: {
        'slide-up-fade': 'slide-up-fade 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer:         'shimmer 1.8s infinite linear',
        'glow-pulse':    'glow-pulse 2s ease-in-out infinite',
        'mesh-drift':    'mesh-drift 18s ease-in-out infinite',
      },
      backgroundImage: {
        'hero-mesh': 'radial-gradient(ellipse at top left, rgba(37,99,235,0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(6,182,212,0.1) 0%, transparent 50%)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
