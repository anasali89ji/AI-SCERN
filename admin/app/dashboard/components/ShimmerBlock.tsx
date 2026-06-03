export function ShimmerCard({ h = 'h-24' }: { h?: string }) {
  return <div className={`card ${h} shimmer border-0`} />
}

export function ShimmerRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="w-8 h-8 rounded-full shimmer flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded shimmer w-1/3" />
        <div className="h-2.5 rounded shimmer w-1/2" />
      </div>
      <div className="h-3 rounded shimmer w-16" />
    </div>
  )
}

export default function ShimmerBlock({ rows = 3, cards = 0 }: { rows?: number; cards?: number }) {
  return (
    <div className="space-y-4">
      {cards > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(cards).fill(0).map((_, i) => <ShimmerCard key={i} />)}
        </div>
      )}
      {Array(rows).fill(0).map((_, i) => <ShimmerRow key={i} />)}
    </div>
  )
}
