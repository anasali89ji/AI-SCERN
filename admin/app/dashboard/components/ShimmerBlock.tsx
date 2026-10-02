// Fix: tabs import { ShimmerBlock } — add named export alias
export function ShimmerBlock({ h = 'h-16' }: { h?: string }) {
  return ShimmerCard({ h })
}

export function ShimmerCard({ h = 'h-16' }: { h?: string }) {
  return (
    <div className={`${h} rounded-xl bg-surface border border-border overflow-hidden relative`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
    </div>
  )
}
