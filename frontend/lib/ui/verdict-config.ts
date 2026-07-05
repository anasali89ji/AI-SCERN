import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import type { Verdict } from '@/types'

export const verdictConfig = {
  AI: {
    icon:   AlertTriangle,
    color:  'text-rose-500',
    border: 'border-rose-500/30',
    bg:     'bg-rose-500/5',
    hex:    '#f43f5e',
    label:  'AI GENERATED',
  },
  HUMAN: {
    icon:   CheckCircle,
    color:  'text-emerald-400',
    border: 'border-emerald-500/30',
    bg:     'bg-emerald-500/5',
    hex:    '#10b981',
    label:  'HUMAN WRITTEN',
  },
  UNCERTAIN: {
    icon:   HelpCircle,
    color:  'text-amber-500',
    border: 'border-amber-500/30',
    bg:     'bg-amber-500/5',
    hex:    '#f59e0b',
    label:  'UNCERTAIN',
  },
} as const

export type VerdictConfig = typeof verdictConfig

export function getVerdictConfig(verdict: Verdict) {
  return verdictConfig[verdict] ?? verdictConfig.UNCERTAIN
}
