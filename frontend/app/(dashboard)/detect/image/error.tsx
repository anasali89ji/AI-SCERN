'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ImageDetectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Route-level catch — this only fires for errors the component-level
    // ErrorBoundary inside page.tsx didn't already handle (e.g. something
    // thrown during the segment's own render/layout), so it's the last
    // line of defense against a blank screen here.
    console.error('[detect/image] route error boundary caught:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full card text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose/10 border border-rose/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-rose" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">Detection page failed to load</h2>
        <p className="text-sm text-text-muted mb-6">
          Something went wrong loading the image detector. Please try again.
        </p>
        {error?.message && (
          <p className="text-text-disabled text-xs font-mono mb-6 break-words">{error.message}</p>
        )}
        <button
          onClick={reset}
          aria-label="Retry loading the image detector"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try Again
        </button>
      </div>
    </div>
  )
}
