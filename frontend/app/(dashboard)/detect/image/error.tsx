'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function ImageDetectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Image detection error boundary:', error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Detection Pipeline Failed</h2>
      <p className="text-slate-400 mb-8 text-sm leading-relaxed">
        The image analysis engine encountered an unexpected error. This could be due to an unsupported file format, corrupted image data, or a transient service issue.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={reset}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
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
