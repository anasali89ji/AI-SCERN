import * as React from 'react'
import { cn } from '@/lib/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  asChild?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:     'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
  secondary:   'bg-surface border border-border hover:border-primary/50 text-text-primary',
  outline:     'border border-border bg-transparent hover:border-primary/40 hover:bg-white/[0.03] text-text-primary',
  ghost:       'bg-transparent hover:bg-white/5 text-text-muted hover:text-text-primary',
  destructive: 'bg-rose-600 text-white hover:bg-rose-500',
  link:        'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm:   'h-8 px-3 text-xs rounded-lg',
  md:   'h-11 px-5 text-sm rounded-xl min-h-[44px]',
  lg:   'h-12 px-7 text-base rounded-xl min-h-[44px]',
  icon: 'h-10 w-10 rounded-xl',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-all duration-200 active:scale-95 cursor-pointer',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
