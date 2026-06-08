import * as React from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex w-full rounded-xl border border-border bg-surface-active px-3.5 py-2.5',
        'text-text-primary placeholder:text-text-disabled',
        'text-base sm:text-sm min-h-[44px]',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-all duration-200',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
