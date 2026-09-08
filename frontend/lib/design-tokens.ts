export const tokens = {
  color: {
    background: {
      base: '#0a0e17',
      elevated: '#0f1520',
      overlay: '#131a28',
      sunken: '#070a10',
    },
    foreground: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      tertiary: '#475569',
      inverse: '#020617',
    },
    accent: {
      emerald: '#2bee34',
      emeraldMuted: 'rgba(43, 238, 52, 0.1)',
      blue: '#60a5fa',
      amber: '#f59e0b',
      red: '#ff4444',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.06)',
      hover: 'rgba(255, 255, 255, 0.12)',
      active: 'rgba(43, 238, 52, 0.3)',
    },
  },
  spacing: {
    0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px',
    5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px', 20: '80px',
  },
  radius: {
    sm: '6px', md: '10px', lg: '16px', xl: '24px', full: '9999px',
  },
  motion: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    default: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 12px 40px rgba(0,0,0,0.5)',
    glow: '0 0 20px rgba(43, 238, 52, 0.15)',
  },
  typography: {
    sans: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, sans-serif',
    mono: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
    sizes: {
      xs: '12px', sm: '13px', base: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '30px', '4xl': '36px',
    },
    leading: {
      tight: '1.25', snug: '1.375', normal: '1.5', relaxed: '1.625',
    },
  },
} as const

export type DesignTokens = typeof tokens
