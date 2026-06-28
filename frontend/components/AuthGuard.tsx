'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Loader2, Zap, Shield, CheckCircle2, Lock, ArrowRight } from 'lucide-react'

const PERKS = [
  'Save your complete scan history',
  'Access all 6 detection tools free',
  'Batch scan up to 20 files at once',
  'AI Assistant for detection help',
  'No credit card required',
]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading }       = useAuth()
  const [checked, setChecked]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setChecked(true), 150)
    return () => clearTimeout(t)
  }, [])

  // Initializing
  if (!checked || loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl font-black text-white">Aiscern</span>
          <Loader2 className="w-6 h-6 text-[#2BEE34] animate-spin" />
        </div>
      </div>
    )
  }

  // Authenticated — render page
  if (user) return <>{children}</>

  // Unauthenticated — show sign-in wall
  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Moss accent top bar */}
        <div className="h-1 w-full bg-[#2BEE34] rounded-t-xl" />

        <div className="bg-[#0A0A0A] border border-[#1E1E1E] border-t-0 rounded-b-xl p-7 space-y-6">

          {/* Brand */}
          <div className="text-center">
            <Link href="/">
              <span className="text-2xl font-black text-white hover:text-[#2BEE34] transition-colors">
                Aiscern
              </span>
            </Link>
            <h1 className="text-xl font-bold text-white mt-3">
              Sign in to <span className="text-[#2BEE34]">Aiscern</span>
            </h1>
            <p className="text-[#6B6B6B] text-sm mt-2 leading-relaxed">
              Create a free account to access AI detection tools — no credit card, no limits.
            </p>
          </div>

          {/* Perks list */}
          <ul className="space-y-2.5 bg-[#141414] border border-[#1E1E1E] rounded-xl p-4">
            {PERKS.map(p => (
              <li key={p} className="flex items-center gap-2.5 text-sm text-[#A3A3A3]">
                <CheckCircle2 className="w-4 h-4 text-[#2BEE34] flex-shrink-0" strokeWidth={2.5} />
                {p}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="space-y-2.5">
            <Link href="/signup"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                         bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-bold text-sm
                         transition-colors duration-150">
              <Zap className="w-4 h-4" />
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                         border border-[#2A2A2A] text-[#A3A3A3] text-sm font-semibold
                         hover:border-[#2BEE34] hover:text-[#2BEE34] transition-all duration-150">
              <Lock className="w-4 h-4" />
              Already have an account? Sign In
            </Link>
          </div>

          {/* Trust */}
          <p className="text-center text-xs text-[#6B6B6B] flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#2BEE34]" />
            Free tier available · No credit card required
          </p>
        </div>
      </div>
    </div>
  )
}
