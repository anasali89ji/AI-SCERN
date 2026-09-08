'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  LoaderCircle, CircleX, CheckCircle2, CircleHelp, ArrowRight, ScanSearch,
} from 'lucide-react'
import { formatConfidence } from '@/lib/utils/helpers'

interface DetectResult {
  verdict?: string
  confidence?: number
  summary?: string
}

const EXAMPLES = [
  { label: 'AI text',    text: 'The intersection of artificial intelligence and human creativity presents a fascinating paradox in contemporary discourse. As machine learning models become increasingly sophisticated in generating coherent, contextually appropriate text, the boundaries between human and algorithmic authorship continue to blur in unprecedented ways.' },
  { label: 'Human text', text: "I spent all weekend trying to fix my leaky faucet and honestly I have no idea what I'm doing. Watched like 6 YouTube videos and still made it worse. Water is now shooting sideways. My neighbor thinks it's hilarious. Calling a plumber tomorrow. RIP my bank account." },
]

/**
 * Live AI Detection Demo (§Plan 6.5)
 *
 * Product-honest messaging rules:
 *  - Anonymous text detection IS supported by the API (5 scans/day per IP),
 *    so "no account needed" is a true claim — kept, but qualified with the
 *    daily limit instead of implying unlimited anonymous access.
 *  - 401/402/429 all render as inline, human-readable states — the demo never
 *    hijacks navigation with a hard redirect.
 */
export function LiveDemo() {
  const [text, setText]       = useState('')
  const [result, setResult]   = useState<DetectResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [activeExample, setActiveExample] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Escape exits focus mode.
  useEffect(() => {
    if (!focused) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') textareaRef.current?.blur() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focused])

  const analyze = async () => {
    if (text.length < 50) return
    setLoading(true); setResult(null); setError(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (res.status === 429) {
        setError('Rate limit reached. Please wait a minute and try again.')
        setLoading(false)
        return
      }
      if (res.status === 402) {
        setError('Daily free limit reached. Create an account or sign in for more scans.')
        setLoading(false)
        return
      }
      if (res.status === 401) {
        setError('Please sign in to continue analyzing.')
        setLoading(false)
        return
      }
      if (res.status >= 500) {
        setError('The detection service is temporarily unavailable. Please try again shortly.')
        setLoading(false)
        return
      }

      const d = await res.json().catch(() => null)
      if (d?.success) {
        setResult(d.result)
      } else {
        setError(d?.error?.message || 'Analysis failed. Please try again.')
      }
    } catch {
      setError('Network error — check your connection and try again.')
    }
    setLoading(false)
  }

  const verdict = result?.verdict
  const isAI    = verdict === 'AI'
  const isHuman = verdict === 'HUMAN'
  const vColor  = isAI ? 'text-rose-400'   : isHuman ? 'text-emerald-400' : 'text-amber-400'
  const vBorder = isAI ? 'border-rose-500/20' : isHuman ? 'border-emerald-500/20' : 'border-amber-500/20'
  const vBg     = isAI ? 'bg-rose-500/5'      : isHuman ? 'bg-emerald-500/5'      : 'bg-amber-500/5'
  const vBar    = isAI ? 'bg-rose-500'        : isHuman ? 'bg-emerald-500'        : 'bg-amber-500'

  return (
    <>
      {/* Focus-mode dim overlay — click or Escape to exit */}
      {focused && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => textareaRef.current?.blur()}
          aria-hidden="true"
        />
      )}

      <div className="relative z-[41] max-w-[520px] w-full mx-auto rounded-xl border border-white/[0.06] bg-surface-elevated shadow-lift overflow-hidden">
        {/* Neutral product card header — no browser-chrome parody (§Plan 6.5) */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-surface">
          <ScanSearch className="w-4 h-4 text-accent" aria-hidden="true" />
          <span className="text-xs font-medium text-silver-700">Live AI Detection Demo</span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold border border-accent/20">
            Free
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {/* Example chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                onClick={() => { setText(ex.text); setActiveExample(ex.label) }}
                className={
                  activeExample === ex.label
                    ? 'text-xs px-3 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent transition-all duration-200'
                    : 'text-xs px-3 py-1.5 rounded-full border border-white/[0.08] text-silver-600 hover:border-accent/30 hover:text-accent transition-all duration-200'
                }
              >
                Try {ex.label}
              </button>
            ))}
          </div>

          <label htmlFor="live-demo-input" className="sr-only">Text to analyze</label>
          <textarea
            id="live-demo-input"
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste text to check whether it is AI-generated…"
            className="w-full min-h-[160px] bg-depth-bg border border-white/[0.08] rounded-lg
                       px-4 py-3 text-[16px] sm:text-sm text-silver-800 placeholder-silver-600
                       resize-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                       transition-all duration-200"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-silver-600" aria-live="polite">
              {text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '· ready'}
            </span>
          </div>

          <button
            onClick={analyze}
            disabled={loading || text.length < 50}
            className="relative w-full mt-3 bg-accent hover:bg-accent-hover text-depth-bg px-5 py-2.5
                       text-sm font-semibold rounded-lg disabled:opacity-40
                       flex items-center justify-center gap-2 min-h-[44px] overflow-hidden
                       transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {loading ? <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="w-4 h-4" aria-hidden="true" />}
            {loading ? 'Analyzing…' : 'Analyze Text'}
            {loading && (
              <span className="absolute bottom-0 left-0 h-0.5 bg-depth-bg/20 w-full" aria-hidden="true">
                <span className="block h-full bg-depth-bg/50 animate-pulse" style={{ width: '60%' }} />
              </span>
            )}
          </button>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 animate-enter"
            >
              <p className="text-sm text-silver-700">{error}</p>
              <div className="mt-2">
                <Link href="/signup" className="text-xs text-accent hover:text-moss-200 font-medium transition-colors duration-200">
                  Create a free account →
                </Link>
              </div>
            </div>
          )}

          {result && (
            <div
              role="status"
              aria-live="polite"
              className={`mt-4 rounded-xl border ${vBorder} ${vBg} p-4 animate-enter`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isAI    ? <CircleX      className={`w-5 h-5 ${vColor} shrink-0`} aria-hidden="true" />
                 : isHuman ? <CheckCircle2 className={`w-5 h-5 ${vColor} shrink-0`} aria-hidden="true" />
                 :           <CircleHelp   className={`w-5 h-5 ${vColor} shrink-0`} aria-hidden="true" />}
                  <span className={`font-bold text-base ${vColor}`}>
                    {isAI ? 'AI Generated' : isHuman ? 'Human Written' : 'Uncertain'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-silver-900 tabular-nums">
                    {formatConfidence(result.confidence || 0)}
                  </div>
                  <div className="text-[10px] text-silver-600">confidence</div>
                </div>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${vBar} transition-all duration-700`}
                  style={{ width: `${result.confidence && result.confidence <= 1 ? result.confidence * 100 : (result.confidence || 0)}%` }}
                />
              </div>
              {result.summary && (
                <p className="text-sm text-silver-600 mt-3">{result.summary}</p>
              )}
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <p className="text-xs text-silver-600">Free tier · no account needed for text</p>
                <Link href="/detect/text" className="text-xs text-accent hover:text-moss-200 font-medium flex items-center gap-1 transition-colors duration-200">
                  Full detection results <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
