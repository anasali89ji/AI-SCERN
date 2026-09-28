'use client'
/**
 * UpgradeModal — real upgrade modal (Module 5)
 *
 * Was previously a no-op stub that called onClose() immediately and
 * rendered nothing — so when creditGuard() rejected a scan with a 402
 * (CREDITS_EXHAUSTED / DAILY_LIMIT_REACHED / MODALITY_LOCKED), there was no
 * UI at all for surfacing that to the user; call sites were left to render
 * a raw error string, if anything. This renders an actual modal with plan
 * options, driven by the same PLAN_LIMITS the /api/user/credits endpoint
 * uses.
 */
import { X, Zap, Check } from 'lucide-react'

interface Props {
  onClose: () => void
  feature?: string
  requiredPlan?: 'starter' | 'pro' | 'enterprise'
  reason?: string // e.g. the message from a 402 HTTPError body
}

const PLANS: Array<{
  id: 'starter' | 'pro' | 'enterprise'
  label: string
  price: string
  scans: string
  highlight?: boolean
}> = [
  { id: 'starter',    label: 'Starter',    price: '$9/mo',  scans: '100 credits · 100 scans/day' },
  { id: 'pro',        label: 'Pro',        price: '$29/mo', scans: '500 credits · 200 scans/day', highlight: true },
  { id: 'enterprise', label: 'Enterprise', price: 'Contact us', scans: 'Unlimited scans' },
]

export default function UpgradeModal({ onClose, feature, requiredPlan, reason }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">
            {feature ? `Upgrade to unlock ${feature}` : 'Upgrade your plan'}
          </h2>
        </div>

        {reason && (
          <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4">
            {reason}
          </p>
        )}

        <div className="space-y-3 mt-4">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                plan.id === requiredPlan || plan.highlight
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{plan.label}</span>
                  {plan.id === requiredPlan && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">{plan.scans}</p>
              </div>
              <span className="text-sm font-semibold text-text-primary">{plan.price}</span>
            </div>
          ))}
        </div>

        <a
          href="/dashboard/credits"
          className="btn-primary w-full mt-5 text-center block"
        >
          View plans &amp; upgrade
        </a>
      </div>
    </div>
  )
}
