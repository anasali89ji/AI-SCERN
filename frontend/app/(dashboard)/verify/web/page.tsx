'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Shield, AlertTriangle, CheckCircle, Loader2, ArrowRight, Lock, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { ConfidenceRing } from '@/components/ConfidenceRing'
import type { DetectionResult } from '@/types'

export default function WebVerificationPage() {
  return (
    <ErrorBoundary>
      <WebVerificationContent />
    </ErrorBoundary>
  )
}

function WebVerificationContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [showMobile, setShowMobile] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = useCallback(async () => {
    if (!url.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/v1/verify/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Verification failed')

      const data = await res.json()
      setResult(data)
      setShowMobile(true)
    } catch (err: any) {
      setError(err.message || 'Unable to verify URL')
    } finally {
      setLoading(false)
    }
  }, [url, loading])

  const isValidUrl = (u: string) => {
    try { new URL(u); return true } catch { return false }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Globe className="w-7 h-7 text-emerald-400" />
          Web Verification
        </h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Analyze websites for AI-generated content, synthetic media, and trustworthiness signals.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 backdrop-blur-sm p-6 sm:p-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="https://example.com/article"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-white/[0.08] text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all text-sm"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={!isValidUrl(url) || loading}
            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-sm transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span className="hidden sm:inline">Verify</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!user && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            Guest scans are limited. <button onClick={() => router.push('/login')} className="underline hover:text-emerald-400">Sign in</button> for full access.
          </div>
        )}
      </div>

      {result && (
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-slate-900/50 backdrop-blur-sm p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ConfidenceRing confidence={result.confidence || 0} size={56} />
              <div>
                <div className="text-lg font-bold text-white">{result.verdict}</div>
                <div className="text-xs text-slate-400">Confidence {(result.confidence * 100).toFixed(1)}%</div>
              </div>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open URL
            </a>
          </div>

          <div className="space-y-3">
            {result.details?.map((detail: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm text-slate-300 bg-slate-950/50 rounded-lg p-3 border border-white/[0.04]">
                {detail.verdict === 'AI' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                )}
                <span>{detail.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MobileResultSheet open={showMobile} onClose={() => setShowMobile(false)} result={result} />
    </div>
  )
}
