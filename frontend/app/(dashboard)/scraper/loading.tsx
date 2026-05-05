export default function ScraperLoading() {
  return (
    <div className="min-h-screen bg-[#08080d] pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-5 animate-pulse">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04]" />
          <div className="h-7 w-44 rounded-xl bg-white/[0.04]" />
          <div className="h-5 w-10 rounded-full bg-white/[0.04]" />
        </div>

        {/* Input card */}
        <div className="bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-10 rounded-xl bg-white/[0.04]" />
            <div className="h-10 w-28 rounded-xl bg-white/[0.04]" />
          </div>
          <div className="flex gap-2 mt-3">
            {[1,2,3].map(i => <div key={i} className="h-6 w-14 rounded-full bg-white/[0.03]" />)}
          </div>
        </div>

        {/* Empty state placeholder */}
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03]" />
          <div className="h-4 w-52 rounded-lg bg-white/[0.03]" />
          <div className="h-3 w-72 rounded-lg bg-white/[0.03]" />
        </div>

      </div>
    </div>
  )
}
