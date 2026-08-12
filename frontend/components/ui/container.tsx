/**
 * components/ui/container.tsx
 *
 * Standardised container with mobile-first responsive padding.
 * Use this as the outer wrapper for all page sections to ensure
 * consistent horizontal padding across breakpoints.
 *
 * @example
 * <Container>                // max-w-7xl (default)
 * <Container size="small">   // max-w-3xl (text-heavy pages)
 * <Container size="large">   // max-w-[100rem] (admin/wide layouts)
 * <Container size="full">    // no max-width
 */

import { cn } from '@/lib/utils/helpers'
import type { ElementType, ReactNode, HTMLAttributes } from 'react'

interface ContainerProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  /** Size variant controlling max-width */
  size?: 'small' | 'default' | 'large' | 'full'
  /** HTML element to render as */
  as?: ElementType
}

export function Container({
  children,
  className,
  size = 'default',
  as: Tag = 'div',
  ...rest
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        // Base: mobile-first horizontal padding
        'mx-auto px-4 sm:px-6 lg:px-8',
        // Max-width per size
        size === 'small'   && 'max-w-3xl',
        size === 'default' && 'max-w-7xl',
        size === 'large'   && 'max-w-[100rem]',
        size === 'full'    && 'max-w-none',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
