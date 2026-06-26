import * as React from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[#1A1A1A] text-[#A3A3A3] border-[#2A2A2A]',
  success: 'bg-[#2BEE34]/10 text-[#2BEE34] border-[#2BEE34]/20',
  warning: 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/20',
  error:   'bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/20',
  info:    'bg-[#1A1A1A] text-[#E5E5E5] border-[#2A2A2A]',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[#A3A3A3]',
  success: 'bg-[#2BEE34]',
  warning: 'bg-[#FFB800]',
  error:   'bg-[#FF4444]',
  info:    'bg-[#E5E5E5]',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  ),
)
Badge.displayName = 'Badge'

export { Badge }
