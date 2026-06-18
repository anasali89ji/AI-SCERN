/**
 * Aiscern Design Tokens
 * Single source of truth for colors, spacing, and animation values.
 * Use these in JS/TS contexts; in Tailwind contexts use the configured classes.
 */

export const tokens = {
  colors: {
    background:      '#08080d',
    surface:         '#0f0f17',
    'surface-active':'#141420',
    border:          'rgba(255,255,255,0.08)',
    'text-blue-500':  '#f1f5f9',
    'text-secondary':'#94a3b8',
    'text-muted':    '#64748b',
    accent:          '#2563eb',
    success:         '#10b981',
    warning:         '#f59e0b',
    danger:          '#f43f5e',
    cyan:            '#06b6d4',
  },
  spacing: {
    section:    '6rem',    // 96px
    'section-sm':'4rem',  // 64px
    card:       '1.5rem', // 24px
  },
  animation: {
    entrance: '0.6s cubic-bezier(0.22, 1, 0.36, 1)',
    hover:    '0.2s ease',
    fast:     '0.15s ease',
  },
  radii: {
    card: '1rem',      // 16px  
    button: '0.75rem', // 12px
    badge: '9999px',
  },
} as const

export type DesignTokens = typeof tokens
