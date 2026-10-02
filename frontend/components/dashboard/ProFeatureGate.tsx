'use client'

import { useState, ReactNode } from 'react'
import { Lock, Crown, Sparkles } from 'lucide-react'

interface ProFeatureGateProps {
  children: ReactNode
  isPro: boolean
  featureName: string
  description?: string
  upgradeUrl?: string
}

/**
 * ProFeatureGate — shows pro features to ALL users (free + pro), but free
 * users see a blurred/locked overlay with an upgrade CTA.
 *
 * Per the user's requirement: "show pro features to free accounts also but
 * add a firewall as a pro feature it only works when user account status
 * will be shown as pro."
 *
 * Usage:
 *   <ProFeatureGate isPro={userPlan.isPro} featureName="500-page scan">
 *     <ProDeepScanButton />
 *   </ProFeatureGate>
 */
export function ProFeatureGate({
  children,
  isPro,
  featureName,
  description,
  upgradeUrl = '/pricing',
}: ProFeatureGateProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (isPro) {
    // Pro users: show the feature normally
    return <>{children}</>
  }

  // Free users: show the feature BLURRED with a lock overlay
  return (
    <div className="relative group" onClick={() => setShowUpgrade(true)}>
      {/* Blurred preview of the feature */}
      <div className="pointer-events-none select-none opacity-50 blur-[2px]">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 mb-2">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">{featureName}</p>
          {description && (
            <p className="text-xs text-slate-300 mb-2">{description}</p>
          )}
          <a
            href={upgradeUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
          >
            <Crown className="w-3.5 h-3.5" />
            Upgrade to Pro
          </a>
        </div>
      </div>
    </div>
  )
}
