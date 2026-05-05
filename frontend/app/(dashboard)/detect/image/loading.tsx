export default function ImageDetectLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-4 w-96 rounded-lg bg-white/5 animate-pulse" />
      </div>
      {/* Main card skeleton */}
      <div className="h-72 w-full rounded-2xl bg-white/5 animate-pulse" />
      {/* Button skeleton */}
      <div className="h-11 w-32 rounded-xl bg-white/5 animate-pulse" />
      {/* Signal bars skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
