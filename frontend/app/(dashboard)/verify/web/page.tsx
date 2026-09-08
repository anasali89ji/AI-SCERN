'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Shield, TriangleAlert, CircleCheck, LoaderCircle, ArrowRight, Lock, SquareArrowOutUpRight } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { ConfidenceRing } from '@/components/ConfidenceRing'
import { verdictConfig } from '@/lib/ui/verdict-config'
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
          <Globe className="w-7 h-7 text-[#2BEE34]" />
          Web Verification
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B] leading-relaxed">
          Analyze websites for AI-generated content, synthetic media, and trustworthiness signals.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-surface/50 backdrop-blur-sm p-6 sm:p-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="https://example.com/article"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0A0A0A] border border-white/[0.08] text-white placeholder:text-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#2BEE34]/30 focus:border-[#2BEE34]/50 transition-all text-[16px] sm:text-sm"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={!isValidUrl(url) || loading}
            className="px-5 py-3 rounded-xl bg-[#2BEE34] hover:bg-[#1A8F1F] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] font-semibold text-sm transition-all flex items-center gap-2"
          >
            {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span className="hidden sm:inline">Verify</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-lg px-4 py-3">
            <TriangleAlert className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!user && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[#6B6B6B]">
            <Shield className="w-3.5 h-3.5" />
            Guest scans are limited. <button onClick={() => router.push('/login')} className="underline hover:text-[#2BEE34]">Sign in</button> for full access.
          </div>
        )}
      </div>

      {result && (
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-surface/50 backdrop-blur-sm p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ConfidenceRing
                confidence={result.confidence <= 1 ? (result.confidence || 0) * 100 : (result.confidence || 0)}
                color={verdictConfig[result.verdict]?.hex ?? verdictConfig.UNCERTAIN.hex}
                size={56}
              />
              <div>
                <div className="text-lg font-bold text-white">{result.verdict}</div>
                <div className="text-xs text-[#6B6B6B]">Confidence {(result.confidence * 100).toFixed(1)}%</div>
              </div>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#2BEE34] transition-colors"
            >
              <SquareArrowOutUpRight className="w-3.5 h-3.5" />
              Open URL
            </a>
          </div>

          <div className="space-y-3">
            {result.signals?.map((signal, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-[#A3A3A3] bg-[#0A0A0A]/50 rounded-lg p-3 border border-white/[0.04]">
                {signal.flagged ? (
                  <TriangleAlert className="w-4 h-4 text-[#FF4444] mt-0.5 flex-shrink-0" />
                ) : (
                  <CircleCheck className="w-4 h-4 text-[#2BEE34] mt-0.5 flex-shrink-0" />
                )}
                <span>{signal.description || signal.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MobileResultSheet isOpen={showMobile} onClose={() => setShowMobile(false)} title="Verification Result">
        {result && (
          <div className="space-y-4 pb-4">
            <div className="flex items-center gap-3">
              <ConfidenceRing
                confidence={result.confidence <= 1 ? (result.confidence || 0) * 100 : (result.confidence || 0)}
                color={verdictConfig[result.verdict]?.hex ?? verdictConfig.UNCERTAIN.hex}
                size={56}
              />
              <div>
                <div className="text-lg font-bold text-white">{result.verdict}</div>
                <div className="text-xs text-[#6B6B6B]">Confidence {(result.confidence * 100).toFixed(1)}%</div>
              </div>
            </div>
            {result.summary && <p className="text-sm text-[#A3A3A3]">{result.summary}</p>}
          </div>
        )}
      </MobileResultSheet>
    </div>
  )
}
