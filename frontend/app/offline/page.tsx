export const metadata = { title: 'Offline | Aiscern', robots: { index: false } }

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#06060e] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      </div>
      <h1 className="text-2xl font-black text-white mb-2">You're offline</h1>
      <p className="text-slate-400 mb-8 max-w-sm text-sm leading-relaxed">
        Aiscern needs an internet connection to analyze content with AI models. Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
