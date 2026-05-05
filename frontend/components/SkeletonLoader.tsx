'use client'
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-hover rounded-lg ${className}`} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-5 space-y-3 ${className}`}>
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-3 w-2/3" />
      <SkeletonLine className="h-3 w-1/2" />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="h-8 w-56" />
        <SkeletonLine className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-surface border border-border/50 rounded-2xl p-4 sm:p-5 space-y-3">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-7 w-16" />
          </div>
        ))}
      </div>
      <SkeletonCard className="h-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard className="h-36" />
        <SkeletonCard className="h-36" />
      </div>
    </div>
  )
}
