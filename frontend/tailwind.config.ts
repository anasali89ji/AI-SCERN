import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background:    '#08080d',
        surface:       '#0f0f17',
        'surface-active': '#141420',
        border:        '#1c1c2e',
        'text-primary':   '#f1f5f9',   // brighter — better contrast
        'text-secondary': '#a0aec0',   // slightly brighter secondary
        'text-muted':     '#718096',   // up from 64748b — passes WCAG AA
        'text-disabled':  '#4a5568',   // up from 334155 — visible on dark bg
        primary:       '#7c3aed',
        secondary:     '#2563eb',
        cyan:          '#06b6d4',
        emerald:       '#10b981',
        amber:         '#f59e0b',
        rose:          '#f43f5e',
        'surface-hover':  'rgba(255,255,255,0.04)',
        'surface-border': 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float':      'float 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan-line':  'scan-line 2s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
