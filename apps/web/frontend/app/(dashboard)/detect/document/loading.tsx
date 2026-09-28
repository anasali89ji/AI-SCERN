export default function DocumentDetectLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-4 w-96 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="h-64 w-full rounded-2xl bg-white/5 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
