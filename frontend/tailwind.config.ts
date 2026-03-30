import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'media',
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
        border:           '#1c1c2e',
        'text-primary':   '#f1f5f9',
        'text-secondary': '#a0aec0',
        'text-muted':     '#718096',
        'text-disabled':  '#4a5568',
        primary:          '#7c3aed',
        secondary:        '#2563eb',
        cyan:             '#06b6d4',
        emerald:          '#10b981',
        amber:            '#f59e0b',
        rose:             '#f43f5e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      animation: {
        'float':      'float 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan-line':  'scan-line 2s linear infinite',
        'scan-sweep': 'scan-sweep 2.4s ease-in-out infinite',
        'shimmer':    'shimmer 1.8s infinite linear',
      },
    },
  },
  plugins: [],
}

export default config
