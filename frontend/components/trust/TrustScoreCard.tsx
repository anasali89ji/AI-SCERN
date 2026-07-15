'use client'

import { Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TrustScoreCardProps {
  score: number
  label: string
  delta?: number
  description?: string
}

export function TrustScoreCard({ score, label, delta = 0, description }: TrustScoreCardProps) {
  const normalized = Math.max(0, Math.min(100, score))
  const color = normalized >= 80 ? 'emerald' : normalized >= 50 ? 'amber' : 'red'
  const colors = {
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', fill: 'bg-emerald-500' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', fill: 'bg-amber-500' },
    red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', fill: 'bg-red-500' },
  }[color]

  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 transition-all hover:scale-[1.01]`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${colors.text}`} />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        {delta !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
            <DeltaIcon className="w-3.5 h-3.5" />
            {Math.abs(delta)}%
          </div>
        )}
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className={`text-3xl font-bold ${colors.text}`}>{normalized}</span>
        <span className="text-xs text-slate-500 mb-1.5">/ 100</span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
        <div
          className={`h-full ${colors.fill} rounded-full transition-all duration-1000`}
          style={{ width: `${normalized}%` }}
        />
      </div>

      {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
    </div>
  )
}
