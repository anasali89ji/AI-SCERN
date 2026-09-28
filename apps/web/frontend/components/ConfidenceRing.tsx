'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface ConfidenceRingProps {
  /** 0-100 */
  confidence: number
  /**
   * Verdict-driven stroke color. Literal hex, not a Tailwind class — SVG
   * `stroke`/`style` attributes can't consume Tailwind classes. Callers pass
   * this from the single shared source of truth (lib/ui/verdict-config.ts
   * `hex` field), not an invented value. Documented data-driven-color
   * exception, see Module 10.2 audit.
   */
  color: string
  size?: number
  strokeWidth?: number
  label?: string
}

/**
 * Circular confidence indicator — animates its arc in on mount/update
 * to match the verdict color, with the percentage centered inside.
 */
export function ConfidenceRing({ confidence, color, size = 128, strokeWidth = 8, label = 'Confidence' }: ConfidenceRingProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, confidence))
  const offset = circumference * (1 - pct / 100)

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={strokeWidth} className="stroke-white/10"
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: mounted ? offset : circumference }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular-nums text-silver-900" style={{ fontSize: size * 0.1875 }}>
          {Math.round(pct)}%
        </span>
        {label && <span className="text-xs text-silver-600 font-medium uppercase tracking-wider mt-0.5">{label}</span>}
      </div>
    </div>
  )
}
