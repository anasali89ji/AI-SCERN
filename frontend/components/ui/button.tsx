'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  // Base — shared across ALL variants
  [
    'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap',
    'transition-all duration-200 ease-out-expo cursor-pointer',
    'active:scale-[0.98]',
    'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:   'bg-primary-500 text-white hover:bg-primary-600 shadow-sm hover:shadow-glow',
        secondary: 'bg-surface-elevated border border-surface-border text-foreground hover:bg-surface-hover hover:border-primary-500/30',
        ghost:     'bg-transparent text-foreground-muted hover:bg-surface-hover hover:text-foreground',
        outline:   'border border-surface-border bg-transparent text-foreground hover:bg-surface-hover hover:border-primary-500/40',
        danger:    'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
      },
      size: {
        sm:   'h-8  px-3  text-xs  rounded-lg  gap-1.5',
        md:   'h-10 px-4  text-sm  rounded-xl  gap-2   min-h-[44px]',
        lg:   'h-12 px-6  text-base rounded-xl gap-2   min-h-[44px]',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as child component (Radix Slot) — useful for Link wrappers */
  asChild?: boolean
  /** Show loading spinner and disable interaction */
  loading?: boolean
  /** Icon rendered before label text */
  leftIcon?: React.ReactNode
  /** Icon rendered after label text */
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />
            <span className="opacity-70">{children}</span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="shrink-0 [&_svg]:size-4">{leftIcon}</span>
            )}
            {children}
            {rightIcon && (
              <span className="shrink-0 [&_svg]:size-4">{rightIcon}</span>
            )}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
