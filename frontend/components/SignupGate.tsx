'use client'
/**
 * SignupGate — shows a non-closeable modal after 3 free scans
 * asking the user to create a free account to continue.
 * Tracks usage in localStorage per tool type.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Zap, Shield, CheckCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const SCAN_LIMIT = 3
const STORAGE_KEY = 'aiscern_total_scans'

export function getGlobalScanCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

export function incrementGlobalScanCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const count = getGlobalScanCount()
    const next  = count + 1
    localStorage.setItem(STORAGE_KEY, String(next))
    window.dispatchEvent(new CustomEvent('aiscern:count', { detail: next }))
    return next
  } catch {
    return 0
  }
}

const PERKS = [
  'Save your scan history',
  'Unlimited detections — always free',
  'Batch scan multiple files',
  'Access AI Chat assistant',
]

export function SignupGate() {
  const { user, loading } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user) { setShow(false); return }
    // Check if already past limit
    if (getGlobalScanCount() >= SCAN_LIMIT) setShow(true)
  }, [user, loading])

  // Listen for new scans via storage events (cross-tab) + custom event
  useEffect(() => {
    const check = () => {
      if (!user && getGlobalScanCount() >= SCAN_LIMIT) setShow(true)
    }
    window.addEventListener('aiscern:scan', check)
    window.addEventListener('storage', check)
    return () => {
      window.removeEventListener('aiscern:scan', check)
      window.removeEventListener('storage', check)
    }
  }, [user])

  if (!show) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        {/* Non-dismissible backdrop */}
        <div className="absolute inset-0 bg-black/85" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative w-full max-w-sm bg-[#0d0d18] border border-white/[0.08] rounded-2xl overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-blue-600" />

          <div className="p-8 space-y-6">
            {/* Logo + heading */}
            <div className="text-center space-y-3">
              <Image
                src="/logo.png"
                alt="Aiscern"
                width={72}
                height={50}
                className="mx-auto object-contain drop-shadow-[0_0_16px_rgba(245,100,0,0.5)]"
              />
              <h2 className="text-2xl font-black text-slate-100">
                You've used <span className="gradient-text">{SCAN_LIMIT} free scans</span>
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Create your free account to keep detecting — no credit card, no limits, no cost. Ever.
              </p>
            </div>

            {/* Perks */}
            <ul className="space-y-2.5 bg-[#141420] rounded-xl p-4">
              {PERKS.map(p => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-slate-400">
                  <CheckCircle className="w-4 h-4 text-[#2BEE34] flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            {/* CTA buttons */}
            <div className="space-y-3">
              <Link href="/signup" className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700  transition-all">
                <Zap className="w-4 h-4" />
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] text-slate-400 text-sm font-semibold hover:bg-[#141420] transition-all">
                Already have an account? Sign In
              </Link>
            </div>

            <p className="text-center text-xs text-slate-600">
              <Shield className="w-3 h-3 inline mr-1" />
              Free tier available · No credit card · No spam
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
