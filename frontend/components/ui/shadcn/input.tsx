import * as React from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex w-full rounded-xl border border-white/[0.08] bg-[#141420] px-3.5 py-2.5',
        'text-slate-100 placeholder:text-slate-600',
        'text-base sm:text-sm min-h-[44px]',
        'focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-all duration-200',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
