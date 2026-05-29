import * as React from "react"
import { cn } from "@/lib/utils"
import { Brain, CheckCircle, AlertTriangle } from "lucide-react"

type DetectionResult = "ai" | "human" | "uncertain"

interface DetectionBadgeProps {
  result: DetectionResult
  confidence?: number
  size?: "sm" | "md" | "lg"
  className?: string
}

const config = {
  ai: {
    label: "AI Generated",
    icon: Brain,
    color: "text-rose-400 bg-rose/10 border-rose/25",
  },
  human: {
    label: "Human Made",
    icon: CheckCircle,
    color: "text-emerald-400 bg-emerald/10 border-emerald/25",
  },
  uncertain: {
    label: "Uncertain",
    icon: AlertTriangle,
    color: "text-amber-400 bg-amber/10 border-amber/25",
  },
}

export function DetectionBadge({ result, confidence, size = "md", className }: DetectionBadgeProps) {
  const { label, icon: Icon, color } = config[result]
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-1.5 gap-2",
  }
  const iconSizes = { sm: 12, md: 14, lg: 18 }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        color,
        sizeClasses[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} className="shrink-0" />
      <span>{label}</span>
      {confidence !== undefined && (
        <span className="opacity-70">({confidence}%)</span>
      )}
    </span>
  )
}
