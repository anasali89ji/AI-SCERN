'use client'
import type { ReactNode } from 'react'

interface GradientBorderProps {
  children: ReactNode
  className?: string
  /** CSS gradient string for the border. Defaults to the site's green/cyan accent. */
  gradient?: string
  /** Border thickness in px */
  width?: number
  rounded?: string
}

/**
 * Wraps content in a gradient border using the padding-box/border-box
 * background trick — no extra DOM nesting beyond one wrapper div, and
 * works with any border-radius.
 */
export function GradientBorder({
  children,
  className = '',
  gradient = 'linear-gradient(135deg, #2BEE34, #06b6d4)',
  width = 1,
  rounded = '0.75rem',
}: GradientBorderProps) {
  return (
    <div
      className={className}
      style={{
        borderRadius: rounded,
        padding: width,
        background: gradient,
      }}
    >
      <div
        className="bg-[#141414] h-full w-full"
        style={{ borderRadius: `calc(${rounded} - ${width}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
