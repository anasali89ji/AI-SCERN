'use client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { X, Zap, Shield, Crown } from 'lucide-react'

interface Props {
  onClose: () => void
  feature?: string
  requiredPlan?: 'starter' | 'pro' | 'enterprise'
}

const PLAN_INFO = {
  starter: { icon: Zap,    color: 'text-cyan-400',  name: 'Starter', price: '$9.99/mo', features: ['100 scans/month', 'Audio detection', 'Batch scanning'] },
  pro:     { icon: Shield, color: 'text-primary',   name: 'Pro',     price: '$29.99/mo', features: ['500 scans/month', 'Video detection', 'API access', 'Heatmaps'] },
  enterprise: { icon: Crown, color: 'text-amber-400', name: 'Enterprise', price: '$99.99/mo', features: ['Unlimited scans', 'White-label', 'SLA', 'SSO'] },
}

export default function UpgradeModal({ onClose, feature, requiredPlan = 'pro' }: Props) {
  const router = useRouter()
  const plan = PLAN_INFO[requiredPlan]
  const Icon = plan.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md card p-6 space-y-5">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className={`w-14 h-14 rounded-2xl bg-surface-active flex items-center justify-center mx-auto ${plan.color}`}>
            <Icon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-text-primary">
            {feature ? `${feature} requires ${plan.name}` : `Upgrade to ${plan.name}`}
          </h2>
          <p className="text-text-muted text-sm">Unlock this feature and more with the {plan.name} plan.</p>
        </div>

        <div className="bg-surface-active rounded-xl p-4 space-y-2">
          {plan.features.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className={`w-1.5 h-1.5 rounded-full ${plan.color.replace('text-', 'bg-')}`} />
              {f}
            </div>
          ))}
          <p className={`text-lg font-black ${plan.color} mt-2`}>{plan.price}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-surface-active transition-colors">
            Maybe later
          </button>
          <button onClick={() => router.push('/pricing')}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
            View Plans
          </button>
        </div>
      </motion.div>
    </div>
  )
}
