import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Verdict color classes — used via verdictConfig objects in detect pages
    'text-rose', 'border-rose', 'bg-rose',
    'text-emerald', 'border-emerald', 'bg-emerald',
    'text-amber', 'border-amber', 'bg-amber',
    // Dynamic opacity modifiers on verdict borders/backgrounds
    'border-rose/30', 'bg-rose/5',
    'border-emerald/30', 'bg-emerald/5',
    'border-amber/30', 'bg-amber/5',
    // Scan stage badge colors
    'bg-primary/10', 'bg-cyan/10', 'bg-emerald/10', 'bg-rose/10',
    'text-primary', 'text-cyan', 'text-emerald', 'text-rose',
    // Dynamic color patterns from WHO_NEEDS card CTAs and trust cards
    {
      pattern: /^(bg|border|text)-(primary|secondary|cyan|emerald|rose|amber)\/(5|8|10|12|14|18|25|28|30|60|80)$/,
    },
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
        border:           '#1c1c2e',
        'text-primary':   '#f1f5f9',
        'text-secondary': '#a0aec0',
        'text-muted':     '#718096',
        'text-disabled':  '#4a5568',
        // Opacity-modifier-compatible format: supports /30, /5, /50 etc. in className
        primary:  'rgb(124 58 237 / <alpha-value>)',
        secondary:'rgb(37 99 235 / <alpha-value>)',
        cyan:     'rgb(6 182 212 / <alpha-value>)',
        emerald:  'rgb(16 185 129 / <alpha-value>)',
        amber:    'rgb(245 158 11 / <alpha-value>)',
        rose:     'rgb(244 63 94 / <alpha-value>)',
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
