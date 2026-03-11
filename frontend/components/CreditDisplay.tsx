'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { auth } from '@/lib/firebase/client'
import { Zap, Crown, TrendingUp, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  credits_remaining: number
  credits_reset_at: string
  plan_id: string
  plan: string
}

const PLAN_MAX: Record<string, number> = { free: 5, starter: 100, pro: 500, enterprise: -1 }
const PLAN_COLORS: Record<string, string> = {
  free: 'text-text-muted',
  starter: 'text-cyan-400',
  pro: 'text-primary',
  enterprise: 'text-amber-400',
}
const PLAN_LABELS: Record<string, string> = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }

export default function CreditDisplay() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const user = auth?.currentUser
    if (!user) return
    supabase.from('profiles')
      .select('credits_remaining, credits_reset_at, plan_id, plan')
      .eq('id', user.uid)
      .single()
      .then(({ data }) => data && setProfile(data))
  }, [])

  if (!profile) return null

  const planKey = profile.plan_id || profile.plan || 'free'
  const max     = PLAN_MAX[planKey] ?? 5
  const used    = max === -1 ? 0 : Math.max(0, max - profile.credits_remaining)
  const pct     = max === -1 ? 100 : Math.round((profile.credits_remaining / max) * 100)
  const resetDays = profile.credits_reset_at
    ? Math.max(0, Math.ceil((new Date(profile.credits_reset_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30
  const color   = PLAN_COLORS[planKey] || 'text-text-muted'
  const isUnlimited = max === -1

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-semibold text-text-primary">Credits</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-surface-active ${color}`}>
            {PLAN_LABELS[planKey] || 'Free'}
          </span>
        </div>
        {planKey === 'free' && (
          <Link href="/pricing" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
            Upgrade <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {isUnlimited ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Crown className="w-4 h-4 text-amber-400" />
          <span>Unlimited scans</span>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{profile.credits_remaining} remaining</span>
              <span>{used}/{max} used</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct > 50 ? 'bg-primary' : pct > 20 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Resets in {resetDays} day{resetDays !== 1 ? 's' : ''}
          </p>
        </>
      )}

      {profile.credits_remaining === 0 && planKey !== 'enterprise' && (
        <Link href="/pricing"
          className="w-full block text-center py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
          Upgrade to continue scanning
        </Link>
      )}
    </div>
  )
}
