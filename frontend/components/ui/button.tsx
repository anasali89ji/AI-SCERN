'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-[#2BEE34] text-[#0A0A0A] hover:bg-[#1A8F1F] active:bg-[#147A18]',
  secondary: 'bg-[#1A1A1A] text-[#E5E5E5] border border-[#2A2A2A] hover:border-[#2BEE34] hover:text-[#2BEE34]',
  ghost:     'bg-transparent text-[#A3A3A3] hover:text-[#FFFFFF] hover:bg-[#1A1A1A]',
  danger:    'bg-[#1A1A1A] text-[#FF4444] border border-[#FF4444]/20 hover:bg-[#FF4444]/10',
  link:      'bg-transparent text-[#2BEE34] hover:underline p-0 h-auto min-h-0',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm:   'h-9  px-3  text-xs  rounded-md  gap-1.5 min-h-[36px]',
  md:   'h-10 px-5  text-sm  rounded-lg  gap-2   min-h-[44px]',
  lg:   'h-12 px-6  text-base rounded-lg gap-2   min-h-[52px]',
  icon: 'h-10 w-10 rounded-lg p-0 min-h-0',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    const isDisabled = disabled || loading

    return (
      <Comp
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base
          'inline-flex items-center justify-center font-semibold whitespace-nowrap',
          'transition-all duration-150 ease-out cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2BEE34]/50',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]',
          'disabled:opacity-50 disabled:pointer-events-none',
          '[&_svg]:pointer-events-none [&_svg]:shrink-0',
          'letter-spacing-[0.01em]',
          // Variant & size
          variant !== 'link' && sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : leftIcon ? (
          <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
        )}
      </Comp>
    )
  },
)

Button.displayName = 'Button'

export { Button }
