'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  Coins, CheckCircle2, Zap, Loader2, CreditCard,
  RefreshCw, ArrowRight, Info,
} from 'lucide-react'

interface Plan {
  id:           string
  name:         string
  pricePKR:     number
  priceUSD:     number
  credits:      number
  period:       string
  creditsLabel: string
}

function CreditsContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user }     = useUser()

  const [plans,   setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [buying,  setBuying]  = useState<string | null>(null)
  const [period,  setPeriod]  = useState<'monthly' | 'yearly'>('monthly')
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const status = searchParams.get('status')
    const order  = searchParams.get('order')
    if (status === 'success' && order) toast.success('Payment successful! Credits will appear within a minute.')
    else if (status === 'failed') toast.error('Payment not completed. No charges were made.')
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      fetch('/api/credits/purchase').then(r => r.json()).then(d => setPlans(d.plans ?? [])),
      fetch('/api/user/stats').then(r => r.json()).then(d => setBalance(d.credits_remaining ?? null)),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handlePurchase = useCallback(async (planId: string) => {
    if (!user) { router.push('/login'); return }
    setBuying(planId)
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, userId: user.id }),
      })
      const data = await res.json()
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else toast.error(data.error || 'Failed to start checkout')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setBuying(null)
    }
  }, [user, router])

  const filtered = plans.filter(p => p.period === period)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-7">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Credits</h1>
          <p className="text-[#6B6B6B] text-sm mt-1">Purchase scan credits. Billed in PKR via XPay.</p>
        </div>
        {balance !== null && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141414] border border-[#2BEE34]/20">
            <Coins className="w-4 h-4 text-[#2BEE34]" />
            <span className="text-sm font-bold text-white">{balance.toLocaleString()}</span>
            <span className="text-xs text-[#6B6B6B]">credits remaining</span>
          </div>
        )}
      </div>

      {/* Period toggle */}
      <div className="inline-flex items-center p-1 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
        {(['monthly', 'yearly'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all duration-150 ${
              period === p ? 'bg-[#2BEE34] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-white'
            }`}>
            {p}
            {p === 'yearly' && (
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2BEE34]/20 text-[#2BEE34]">-20%</span>
            )}
          </button>
        ))}
      </div>

      {/* Plans */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-xl bg-[#1A1A1A] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Coins className="w-10 h-10 text-[#3A3A3A] mx-auto mb-3" />
          <p className="text-[#6B6B6B]">No plans available — check back soon.</p>
          <button onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-sm text-[#A3A3A3] hover:text-white transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {filtered.map((plan, i) => {
            const isPopular = i === 1
            const isActive  = buying === plan.id
            return (
              <div key={plan.id}
                className={`relative rounded-xl border p-6 flex flex-col transition-all duration-200 ${
                  isPopular
                    ? 'border-[#2BEE34] bg-[#2BEE34]/[0.04] shadow-[0_0_30px_rgba(43,238,52,0.12)]'
                    : 'border-[#1E1E1E] bg-[#141414] hover:border-[#2A2A2A]'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#2BEE34] text-[#0A0A0A] text-xs font-bold whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <div className="text-3xl font-black text-white">
                    PKR {plan.pricePKR.toLocaleString()}
                    <span className="text-sm text-[#6B6B6B] font-normal ml-1">/{plan.period === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-1">≈ ${plan.priceUSD} USD</p>
                </div>

                <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                  <Coins className="w-5 h-5 text-[#2BEE34] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-black text-white">{plan.credits.toLocaleString()}</p>
                    <p className="text-[10px] text-[#6B6B6B]">{plan.creditsLabel}</p>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {['Text detection', 'Image detection', 'Audio detection', 'Video detection',
                    ...(plan.credits >= 500 ? ['Batch analysis', 'Priority queue'] : []),
                  ].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#A3A3A3]">
                      <CheckCircle2 className="w-4 h-4 text-[#2BEE34] flex-shrink-0" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={isActive || !!buying}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                              font-semibold text-sm transition-all duration-150 disabled:opacity-60 ${
                    isPopular
                      ? 'bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A]'
                      : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]'
                  }`}
                >
                  {isActive
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><CreditCard className="w-4 h-4" /> Buy via XPay</>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Info */}
      <div className="flex gap-3 p-4 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-sm text-[#A3A3A3]">
        <Info className="w-4 h-4 text-[#2BEE34] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>Credits are consumed per scan. 1 credit = 1 detection on any modality.</p>
          <p>Batch scans consume 1 credit per file. ARIA chat does not consume credits.</p>
          <p>Payments are processed securely by XPay (Pakistan). No card data stored by Aiscern.</p>
        </div>
      </div>

      {/* Enterprise */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A]">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white mb-0.5">Need bulk credits or custom limits?</p>
          <p className="text-sm text-[#A3A3A3]">Enterprise plans with invoiced billing and dedicated support available.</p>
        </div>
        <a href="mailto:sales@aiscern.com"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm transition-colors">
          Contact Sales <ArrowRight className="w-4 h-4" />
        </a>
      </div>

    </div>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-[#2BEE34] animate-spin" />
      </div>
    }>
      <CreditsContent />
    </Suspense>
  )
}
