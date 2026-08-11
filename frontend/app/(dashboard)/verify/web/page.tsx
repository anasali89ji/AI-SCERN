'use client'

import { useState } from 'react'
import { Globe2, Loader2, Search } from 'lucide-react'
import { TrustScoreCard } from '@/components/trust/TrustScoreCard'
import { toUserError } from '@/lib/utils/user-errors'

export default function WebVerifyPage() {
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [result, setResult]   = useState<any | null>(null)

  async function handleVerify() {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/verify/web', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed.')
      setResult(data)
    } catch (err) {
      setError(toUserError(err instanceof Error ? err.message : 'NETWORK_ERROR'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Globe2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">WebVerify™</h1>
          <p className="text-sm text-text-disabled">Verify website trust, SSL, and reputation signals.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-surface/50 p-4 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          placeholder="https://example.com"
          className="flex-1 bg-transparent outline-none px-3 py-2 text-sm placeholder:text-text-disabled"
        />
        <button
          onClick={handleVerify}
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-bg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Verify
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-sm text-rose">{error}</div>
      )}

      {result && (
        <TrustScoreCard
          tool={result.tool}
          trustOverall={result.scores.trust.overall}
          riskOverall={result.scores.risk.overall}
          confidenceOverall={result.scores.confidence.overall}
          components={result.scores.trust.components}
          evidence={result.evidence}
          findings={result.findings}
          recommendations={result.recommendations}
        />
      )}
    </div>
  )
}
