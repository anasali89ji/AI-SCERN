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
          "relative overflow-hidden rounded-xl",
          "bg-surface/80 border border-white/8",
          variant === "elevated" && "shadow-xl shadow-black/20",
          variant === "bordered" && "border-white/12",
          hover && "transition-all duration-300 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 hover:border-white/14",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }
