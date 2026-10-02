'use client'

import { useState, useEffect, useCallback } from 'react'

export interface UserPlanInfo {
  plan: string
  planLabel: string
  isPaid: boolean
  isPro: boolean
  creditsBalance: number
  creditsRemaining: number
  dailyScans: number
  dailyLimit: number
  scansToday: number
  planUpdatedAt: string | null
  planExpiresAt: string | null
  creditPeriodEnd: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * useUserPlan — shared hook for reading the current user's plan/credits.
 *
 * Previously every component that needed plan info fetched /api/user/credits
 * independently (CreditDisplay, UsageLimitBanner, UpgradeModal, profile page).
 * This hook centralizes that logic + adds auto-refresh when a scan completes
 * (listens for the 'aiscern:scan-saved' custom event).
 *
 * Also exposes planExpiresAt so the UI can show "Pro expires in N days".
 */
export function useUserPlan(): UserPlanInfo {
  const [info, setInfo] = useState<Omit<UserPlanInfo, 'loading' | 'error' | 'refresh'>>({
    plan: 'free',
    planLabel: 'Free',
    isPaid: false,
    isPro: false,
    creditsBalance: 0,
    creditsRemaining: 0,
    dailyScans: 0,
    dailyLimit: 10,
    scansToday: 0,
    planUpdatedAt: null,
    planExpiresAt: null,
    creditPeriodEnd: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/credits', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setInfo({
        plan: data.plan || 'free',
        planLabel: data.plan_label || 'Free',
        isPaid: data.is_paid || false,
        isPro: ['pro', 'team', 'enterprise'].includes(data.plan),
        creditsBalance: data.credits_balance || 0,
        creditsRemaining: data.credits_remaining || 0,
        dailyScans: data.scans_today || 0,
        dailyLimit: data.daily_limit || 10,
        scansToday: data.scans_today || 0,
        planUpdatedAt: data.plan_updated_at || null,
        planExpiresAt: data.plan_expires_at || data.credit_period_end || null,
        creditPeriodEnd: data.credit_period_end || null,
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Auto-refresh when a scan completes (credits may have changed)
    const handler = () => refresh()
    window.addEventListener('aiscern:scan-saved', handler)
    return () => window.removeEventListener('aiscern:scan-saved', handler)
  }, [refresh])

  return { ...info, loading, error, refresh }
}
