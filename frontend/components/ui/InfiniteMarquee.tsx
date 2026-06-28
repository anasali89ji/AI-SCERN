/**
 * InfiniteMarquee — DISABLED per design spec Section 10.
 * Anti-pattern: marquees/carousels distract and reduce readability.
 * Replaced with a static grid renderer to keep existing import shapes working.
 */
import { cn } from '@/lib/cn'

interface MarqueeProps {
  children:      React.ReactNode[]
  className?:    string
  speed?:        number
  direction?:    'left' | 'right'
  gap?:          number
  pauseOnHover?: boolean
}

export function InfiniteMarquee({ children, className }: MarqueeProps) {
  return (
    <div className={cn('flex flex-wrap gap-4 justify-center', className)}>
      {children}
    </div>
  )
}
