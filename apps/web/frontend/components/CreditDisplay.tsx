'use client'
/**
 * CreditDisplay — real credits/plan widget (Module 5)
 *
 * Was previously a static "Free & Unlimited" stub even though the backend
 * (lib/middleware/credit-guard.ts, /api/user/credits) has always enforced
 * real per-plan daily scan limits and a monthly credit pool. This wires the
 * sidebar to the same data the profile page's Credits & Usage section uses.
 */
import { useEffect, useState } from 'react'
import { Zap, Loader2 } from 'lucide-react'

interface CreditsData {
  plan: string
  plan_label: string
  is_paid: boolean
  credits_balance: number
  credits_total: number
  credits_pct: number
  scans_today: number
  daily_limit: number // -1 = unlimited
  daily_pct: number
}

export default function CreditDisplay() {
  const [data, setData] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/credits')
      .then(res => {
        if (res.status === 401) { setSignedOut(true); return null }
        return res.json()
      })
      .then(json => { if (!cancelled && json) setData(json) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (signedOut) return null

  if (loading) {
    return (
      <div className="card p-4 flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-xs text-text-muted">Loading usage…</span>
      </div>
    )
  }

  if (!data) return null

  const unlimited = data.daily_limit === -1
  const nearDailyLimit = !unlimited && data.daily_pct >= 80
  const nearCreditLimit = data.credits_total > 0 && data.credits_pct >= 80

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-text-primary">Access</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-active text-primary">
          {data.plan_label}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">Scans today</span>
            <span className={nearDailyLimit ? 'text-amber-400 font-medium' : 'text-text-primary'}>
              {data.scans_today}{unlimited ? '' : ` / ${data.daily_limit}`}
            </span>
          </div>
          {!unlimited && (
            <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
              <div
                className={`h-full rounded-full ${nearDailyLimit ? 'bg-amber-400' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, data.daily_pct)}%` }}
              />
            </div>
          )}
        </div>

        {data.credits_total > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-muted">Monthly credits</span>
              <span className={nearCreditLimit ? 'text-amber-400 font-medium' : 'text-text-primary'}>
                {data.credits_balance} / {data.credits_total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
              <div
                className={`h-full rounded-full ${nearCreditLimit ? 'bg-amber-400' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, data.credits_pct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {!data.is_paid && (
        <a
          href="/dashboard/credits"
          className="mt-3 block text-center text-xs font-medium text-primary hover:underline"
        >
          Upgrade for more scans →
        </a>
      )}
    </div>
  )
}
