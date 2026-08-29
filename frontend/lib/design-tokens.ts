/**
 * Aiscern design tokens — canonical design reference.
 *
 * The dark graphite + luminous moss system is the product's visual
 * foundation. Page-specific hard-coded hex values should not duplicate
 * these semantics: import tokens from here or use the Tailwind aliases
 * (silver / moss / surface / accent / depth) instead.
 *
 * §Plan 8.2 — semantic aliases make intent readable:
 *   surface.page / raised / sunken / overlay
 *   text.primary / secondary / muted
 *   border.subtle / strong
 *   accent.primary
 *   status.success / warning / error / info
 */
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

  // ── Semantic aliases (plan §8.2) ───────────────────────────────────────────
  // These are the preferred reference for new UI code. They map onto the
  // concrete scales above / the Tailwind silver+moss system so that the
  // whole product speaks one visual language.
  semantic: {
    surface: {
      page:    '#141414', // silver-100 — page canvas
      raised:  '#1A1A1A', // silver-200 — cards, elevated panels
      sunken:  '#0A0A0A', // silver-50  — inset wells, code, depth backgrounds
      overlay: '#1E1E1E', // silver-300 — floating panels, modals, sheets
    },
    text: {
      primary:   '#FFFFFF', // silver-900
      secondary: '#E5E5E5', // silver-800
      muted:     '#A3A3A3', // silver-700
      disabled:  '#6B6B6B', // silver-600
      inverse:   '#0A0A0A', // on-accent text
    },
    border: {
      subtle: '#1E1E1E', // silver-300
      strong: '#2A2A2A', // silver-400
      accent: 'rgba(43, 238, 52, 0.3)',
    },
    accent: {
      primary:      '#2BEE34', // moss-300
      primaryHover: '#1A8F1F', // accent.hover
      primaryGlow:  'rgba(43, 238, 52, 0.15)',
    },
    status: {
      success: '#2BEE34', // moss-300 — verified / human / pass
      warning: '#FFB800', // amber     — uncertain / review
      error:   '#FF4444', // rose      — AI-generated / fail
      info:    '#06b6d4', // cyan      — neutral emphasis
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
