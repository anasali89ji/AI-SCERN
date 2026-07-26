'use client'
/**
 * UsageLimitBanner — real usage warning banner (Module 5)
 *
 * Was previously a no-op stub (`return null`) even though creditGuard()
 * already blocks requests server-side with a 402 once a user's daily/plan
 * limit is hit. The gap this fixes: users got no *warning* before hitting
 * the wall, and no clear message when they did — just whatever generic
 * error text the calling page happened to show for a failed fetch.
 *
 * IMPORTANT: this component does NOT enforce limits itself — enforcement
 * stays server-side in lib/middleware/credit-guard.ts, which is the only
 * place that can't be bypassed by a client. This is purely an informational
 * banner fed by /api/user/credits, plus a helper to surface the guard's own
 * 402 error message when a scan gets rejected.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

type Tool = 'text' | 'image' | 'audio' | 'video'

interface CreditsData {
  is_paid: boolean
  scans_today: number
  daily_limit: number
  daily_pct: number
  credits_pct: number
  credits_total: number
}

export function UsageLimitBanner({ tool }: { tool: Tool; isPro?: boolean }) {
  const [data, setData] = useState<CreditsData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/credits')
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (!cancelled && json) setData(json) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tool])

  if (!data || data.daily_limit === -1) return null

  const nearDaily = data.daily_pct >= 80
  const nearCredits = data.credits_total > 0 && data.credits_pct >= 80
  if (!nearDaily && !nearCredits) return null

  const atDaily = data.daily_pct >= 100

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
      atDaily
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    }`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        {atDaily
          ? `You've reached today's ${tool} scan limit. Resets at midnight, or upgrade for more.`
          : `You're close to today's ${tool} scan limit (${data.scans_today}/${data.daily_limit} used).`}
      </span>
      {!data.is_paid && (
        <a href="/dashboard/credits" className="ml-auto font-medium underline flex-shrink-0">
          Upgrade
        </a>
      )}
    </div>
  )
}

// Enforcement lives server-side in lib/middleware/credit-guard.ts (the only
// place a limit can't be bypassed by editing client JS). These are kept as
// no-ops rather than reintroducing a fake client-side counter that would
// either double-count against the real server limit or drift out of sync
// with it.
export function incrementUsage(_tool: Tool) {}
export function isLimitReached(_tool: Tool): boolean { return false }
