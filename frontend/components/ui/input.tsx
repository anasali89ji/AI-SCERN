'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const inputVariants = cva(
  [
    'flex w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground',
    'placeholder:text-foreground-disabled',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'min-h-[44px]',
  ],
  {
    variants: {
      inputState: {
        default: 'border-surface-border focus:border-primary-500 focus:ring-primary-500/30',
        error:   'border-rose-500/60   focus:border-rose-500   focus:ring-rose-500/30',
        success: 'border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/30',
      },
    },
    defaultVariants: {
      inputState: 'default',
    },
  },
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>
  {
  /** Validation/visual state */
  inputState?: VariantProps<typeof inputVariants>['inputState']
  /** Icon or element rendered on the left inside the input wrapper */
  leftElement?: React.ReactNode
  /** Icon or element rendered on the right inside the input wrapper */
  rightElement?: React.ReactNode
  /** Error message shown below the field (also sets state='error') */
  error?: string
  /** Label shown above the field */
  label?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, inputState, leftElement, rightElement, error, label, id, ...props },
    ref,
  ) => {
    const inputId = id ?? React.useId()
    const errorId = `${inputId}-error`
    const resolvedState: InputProps['inputState'] = error ? 'error' : inputState

    const inputEl = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          inputVariants({ inputState: resolvedState }),
          leftElement && 'pl-10',
          rightElement && 'pr-10',
          className,
        )}
        {...props}
      />
    )

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground-secondary"
          >
            {label}
          </label>
        )}

        {leftElement || rightElement ? (
          <div className="relative flex items-center">
            {leftElement && (
              <span className="pointer-events-none absolute left-3 flex items-center text-foreground-muted [&_svg]:size-4">
                {leftElement}
              </span>
            )}
            {inputEl}
            {rightElement && (
              <span className="absolute right-3 flex items-center text-foreground-muted [&_svg]:size-4">
                {rightElement}
              </span>
            )}
          </div>
        ) : (
          inputEl
        )}

        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input, inputVariants }
