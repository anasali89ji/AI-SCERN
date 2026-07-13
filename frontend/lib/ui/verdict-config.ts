import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import type { Verdict } from '@/types'

// `hex` is intentionally kept as a literal value — it feeds inline `style`/SVG
// `stroke` props (e.g. ConfidenceRing's arc color, drop-shadow glow) where
// Tailwind classes can't reach. That's the documented per-item data-driven
// color exception (Module 10.2 audit) — everything else here uses tokens.
export const verdictConfig = {
  AI: {
    icon:   AlertTriangle,
    color:  'text-error',
    border: 'border-error/30',
    bg:     'bg-error/5',
    hex:    '#FF4444', // error token
    label:  'SYNTHESIZED',
  },
  HUMAN: {
    icon:   CheckCircle,
    color:  'text-accent',
    border: 'border-accent/30',
    bg:     'bg-accent/5',
    hex:    '#2BEE34', // accent.DEFAULT token
    label:  'AUTHENTIC',
  },
  UNCERTAIN: {
    icon:   HelpCircle,
    color:  'text-warning',
    border: 'border-warning/30',
    bg:     'bg-warning/5',
    hex:    '#FFB800', // warning token
    label:  'UNCERTAIN',
  },
} as const

export type VerdictConfig = typeof verdictConfig

export function getVerdictConfig(verdict: Verdict) {
  return verdictConfig[verdict] ?? verdictConfig.UNCERTAIN
}
