import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import type { Verdict } from '@/types'

export const verdictConfig = {
  AI: {
    icon:   AlertTriangle,
    color:  'text-[#FF4444]',
    border: 'border-[#FF4444]/30',
    bg:     'bg-[#FF4444]/5',
    hex:    '#FF4444',
    label:  'AI GENERATED',
  },
  HUMAN: {
    icon:   CheckCircle,
    color:  'text-[#2BEE34]',
    border: 'border-[#2BEE34]/30',
    bg:     'bg-[#2BEE34]/5',
    hex:    '#2BEE34',
    label:  'HUMAN WRITTEN',
  },
  UNCERTAIN: {
    icon:   HelpCircle,
    color:  'text-[#FFB800]',
    border: 'border-[#FFB800]/30',
    bg:     'bg-[#FFB800]/5',
    hex:    '#FFB800',
    label:  'UNCERTAIN',
  },
} as const

export type VerdictConfig = typeof verdictConfig

export function getVerdictConfig(verdict: Verdict) {
  return verdictConfig[verdict] ?? verdictConfig.UNCERTAIN
}
