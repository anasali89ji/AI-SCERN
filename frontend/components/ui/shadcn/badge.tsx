import * as React from 'react'
import { cn } from '@/lib/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:     'bg-primary-500/10 text-primary-400 border-primary-500/20',
  secondary:   'bg-white/[0.05] text-slate-400 border-white/[0.08]',
  success:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warning:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  destructive: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  outline:     'bg-transparent text-slate-500 border-white/[0.08]',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
