import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#07070d',
        surface: '#0f0f1a',
        border: '#1a1a2e',
        'border-bright': '#2a2a45',
        accent: '#7c3aed',
        'accent2': '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#f43f5e',
        'text-1': '#e2e8f0',
        'text-2': '#94a3b8',
        'text-3': '#475569',
      }
    }
  },
  plugins: []
}
export default config
