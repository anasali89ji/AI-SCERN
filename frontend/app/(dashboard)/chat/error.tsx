'use client'

import { useEffect } from 'react'
import { TriangleAlert, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('ARIA chat error boundary:', error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
        <TriangleAlert className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">ARIA Connection Disrupted</h2>
      <p className="text-slate-400 mb-8 text-sm leading-relaxed">
        The forensic AI assistant hit an unexpected error mid-conversation. Your detection history is unaffected — this only interrupted the chat session.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={reset}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reinitialize ARIA
        </button>
        <Link
          href="/dashboard"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/[0.08] text-white font-medium text-sm hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-[10px] text-slate-600 font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  )
}
