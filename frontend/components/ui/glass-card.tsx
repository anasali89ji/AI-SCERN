import * as React from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "bordered"
  hover?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", hover = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-xl border border-white/8",
          // Use solid bg instead of backdrop-blur (disabled on mobile by globals.css)
          "bg-surface",
          variant === "elevated" && "shadow-xl shadow-black/20",
          hover && "transition-all duration-200 hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20",
          className
        )}
        {...props}
      >
        {/* Subtle inner gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }
