import * as React from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  label?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#E5E5E5]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-[#6B6B6B] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg',
              'px-4 py-3 text-sm text-[#E5E5E5] placeholder-[#6B6B6B]',
              'transition-all duration-150',
              'focus:border-[#2BEE34] focus:ring-1 focus:ring-[#2BEE34]/30 focus:outline-none',
              'disabled:bg-[#1A1A1A] disabled:border-[#2A2A2A] disabled:text-[#6B6B6B] disabled:cursor-not-allowed',
              error && 'border-[#FF4444] ring-1 ring-[#FF4444]/30',
              leftIcon  && 'pl-10',
              rightIcon && 'pr-10',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-[#6B6B6B]">
              {rightIcon}
            </span>
          )}
        </div>
        {helperText && (
          <p className={cn('text-xs', error ? 'text-[#FF4444]' : 'text-[#6B6B6B]')}>
            {helperText}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
