'use client'
/**
 * SignupGate — shows a non-closeable modal after 3 free scans
 * asking the user to create a free account to continue.
 * Tracks usage in localStorage per tool type.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Zap, Shield, CheckCircle, ArrowRight } from 'lucide-react'
import { SignInButton, SignUpButton } from '@clerk/nextjs'
import { useAuth } from '@/components/auth-provider'

const SCAN_LIMIT = 3
const STORAGE_KEY = 'aiscern_total_scans'

export function getGlobalScanCount(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10)
}

export function incrementGlobalScanCount(): number {
  if (typeof window === 'undefined') return 0
  const next = getGlobalScanCount() + 1
  localStorage.setItem(STORAGE_KEY, String(next))
  return next
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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="relative w-full max-w-md bg-surface border border-primary/30 rounded-2xl shadow-2xl shadow-primary/20 overflow-hidden"
        >
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-orange-400 to-amber-400" />

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
              <h2 className="text-2xl font-black text-text-primary">
                You've used <span className="gradient-text">{SCAN_LIMIT} free scans</span>
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Create your free account to keep detecting — no credit card, no limits, no cost. Ever.
              </p>
            </div>

            {/* Perks */}
            <ul className="space-y-2.5 bg-surface-active rounded-xl p-4">
              {PERKS.map(p => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            {/* CTA buttons */}
            <div className="space-y-3">
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
                <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all">
                  <Zap className="w-4 h-4" />
                  Create Free Account
                  <ArrowRight className="w-4 h-4" />
                </button>
              </SignUpButton>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-surface-hover transition-all">
                  Already have an account? Sign In
                </button>
              </SignInButton>
            </div>

            <p className="text-center text-xs text-text-disabled">
              <Shield className="w-3 h-3 inline mr-1" />
              Free forever · No credit card · No spam
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
