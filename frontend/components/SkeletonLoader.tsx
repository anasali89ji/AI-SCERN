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
    <div className="p-6 space-y-4">
      <SkeletonLine className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3].map(i => <SkeletonCard key={i} />)}
      </div>
      <SkeletonCard className="h-32" />
    </div>
  )
}
