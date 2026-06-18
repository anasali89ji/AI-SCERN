import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const skeletonVariants = cva(
  // Shimmer animation via globals.css .shimmer utility
  'shimmer',
  {
    variants: {
      variant: {
        text:      'rounded h-[1em]',
        circle:    'rounded-full',
        rectangle: 'rounded-lg',
        card:      'rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'rectangle',
    },
  },
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  )
}

// ── SkeletonGroup — compose multiple skeletons with consistent spacing ────────
interface SkeletonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: 'tight' | 'default' | 'loose'
}

function SkeletonGroup({ className, gap = 'default', children, ...props }: SkeletonGroupProps) {
  const gapClass = { tight: 'gap-2', default: 'gap-3', loose: 'gap-4' }[gap]
  return (
    <div className={cn('flex flex-col', gapClass, className)} {...props}>
      {children}
    </div>
  )
}

export { Skeleton, SkeletonGroup, skeletonVariants }
