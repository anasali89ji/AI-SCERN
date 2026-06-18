import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border text-xs font-semibold',
  {
    variants: {
      variant: {
        neutral:  'bg-surface-elevated   border-surface-border  text-foreground-secondary',
        primary:  'bg-primary-500/10     border-primary-500/20  text-primary-400',
        success:  'bg-emerald-500/10     border-emerald-500/30  text-emerald-400',
        warning:  'bg-amber-500/10       border-amber-500/30    text-amber-400',
        danger:   'bg-rose-500/10        border-rose-500/30     text-rose-400',
        info:     'bg-cyan-500/10        border-cyan-500/30     text-cyan-400',
      },
      // Named 'appearance' to avoid collision with HTMLAttributes 'style' (CSSProperties)
      appearance: {
        solid:   '',
        outline: 'bg-transparent',
        soft:    '',
      },
      size: {
        sm: 'px-2   py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3   py-1   text-sm',
      },
      pulse: {
        true:  'animate-pulse',
        false: '',
      },
    },
    compoundVariants: [
      // Outline appearance overrides background
      { appearance: 'outline', variant: 'neutral', className: 'bg-transparent' },
      { appearance: 'outline', variant: 'primary', className: 'bg-transparent' },
      { appearance: 'outline', variant: 'success', className: 'bg-transparent' },
      { appearance: 'outline', variant: 'warning', className: 'bg-transparent' },
      { appearance: 'outline', variant: 'danger',  className: 'bg-transparent' },
      { appearance: 'outline', variant: 'info',    className: 'bg-transparent' },
    ],
    defaultVariants: {
      variant:    'neutral',
      appearance: 'solid',
      size:       'md',
      pulse:      false,
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Prepend a small colored status dot */
  dot?: boolean
}

const dotColors: Record<string, string> = {
  neutral: 'bg-foreground-muted',
  primary: 'bg-primary-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger:  'bg-rose-400',
  info:    'bg-cyan-400',
}

function Badge({ className, variant, appearance, size, pulse, dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, appearance, size, pulse }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'inline-block size-1.5 rounded-full shrink-0',
            dotColors[variant ?? 'neutral'],
          )}
          aria-hidden
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
