/**
 * Suspense fallback for the streamed server panels. Pure markup -- a Server Component
 * (no hooks, no 'use client') so it ships zero JavaScript.
 */
export function PanelSkeleton({ title, rows = 3 }: { title: string; rows?: number }) {
  return (
    <section className="card space-y-3" aria-busy="true" aria-label={`${title} loading`}>
      <h2 className="text-sm font-semibold text-silver-700">{title}</h2>
      <div className="h-2.5 w-full rounded-full bg-white/[0.05] animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 rounded-lg bg-white/[0.05] animate-pulse" />
      ))}
    </section>
  )
}
