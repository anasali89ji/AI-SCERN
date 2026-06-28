'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, X, CheckCircle } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface Notification {
  id: number; type: string; title: string; message: string
  data: Record<string,any>; created_at: string
}

const PLAN_PERKS: Record<string, string[]> = {
  pro:        ['100 scans/day',  'Audio & Video detection', 'Web scanner', 'PDF reports'],
  team:       ['500 scans/day',  'All modalities',          'Priority queue','API access'],
  enterprise: ['Unlimited scans','All modalities',          'Custom models', 'Dedicated support'],
}

function UpgradeModal({ notif, onDismiss }: { notif: Notification; onDismiss: () => void }) {
  const plan    = notif.data?.plan || 'pro'
  const perks   = PLAN_PERKS[plan] || PLAN_PERKS.pro
  const expires = notif.data?.expires_at

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm bg-[#0f0f17] border border-white/[0.08] rounded-2xl p-8 overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/5 pointer-events-none" />

        {/* Confetti dots */}
        {[...Array(12)].map((_,i) => (
          <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-primary/50"
            style={{ top: `${(i * 31 + 8) % 95}%`, left: `${(i * 27 + 4) % 95}%` }} />
        ))}

        <button onClick={onDismiss} className="absolute top-4 right-4 p-1.5 rounded-full text-[#4a5568] hover:text-white hover:bg-white/[0.05] transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Crown className="w-10 h-10 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-white text-center mb-2">{notif.title}</h2>
        <p className="text-sm text-[#94a3b8] text-center mb-6 leading-relaxed">{notif.message}</p>

        {/* Perks */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {perks.map(perk => (
            <div key={perk} className="flex items-center gap-2 px-3 py-2 bg-[#ffffff06] border border-[#ffffff0c] rounded-xl">
              <CheckCircle className="w-3.5 h-3.5 text-[#2BEE34] flex-shrink-0" />
              <span className="text-xs text-[#94a3b8]">{perk}</span>
            </div>
          ))}
        </div>

        {expires && (
          <p className="text-[11px] text-[#4a5568] text-center mb-4">
            Access expires: {new Date(expires).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <a
            href="/pricing"
            onClick={onDismiss}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white text-center transition-all block"
            style={{ background:'linear-gradient(135deg, #2563eb, #2563eb)' }}
          >
            View Pricing &amp; Upgrade →
          </a>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

export function UpgradeNotificationProvider() {
  const { user } = useAuth()
  const [queue, setQueue]     = useState<Notification[]>([])
  const [current, setCurrent] = useState<Notification | null>(null)

  const poll = useCallback(async () => {
    if (!user) return
    try {
      const res  = await fetch('/api/notifications')
      const data = await res.json()
      const upgrades = (data.notifications || []).filter((n:Notification) => n.type === 'plan_upgrade')
      if (upgrades.length > 0) setQueue(upgrades)
    } catch {}
  }, [user])

  useEffect(() => { poll(); const t = setInterval(poll, 30_000); return () => clearInterval(t) }, [poll])

  useEffect(() => {
    if (queue.length > 0 && !current) {
      setCurrent(queue[0])
      setQueue(q => q.slice(1))
    }
  }, [queue, current])

  const dismiss = async () => {
    if (!current) return
    await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: current.id }) }).catch(() => {})
    setCurrent(null)
  }

  return (
    <AnimatePresence>
      {current && <UpgradeModal notif={current} onDismiss={dismiss} />}
    </AnimatePresence>
  )
}
