'use client'
/**
 * AuthGuard — client-side safety net for protected pages.
 * Shows a beautiful sign-in popup if user is not authenticated.
 * Works even if middleware redirect fails (e.g. during Clerk key setup).
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Zap, Shield, CheckCircle, Lock, ArrowRight } from 'lucide-react'
import { SignInButton, SignUpButton } from '@clerk/nextjs'

const PERKS = [
  'Save your complete scan history',
  'Access all 6 detection tools free',
  'Batch scan up to 20 files at once',
  'AI Assistant for detection help',
  'No credit card — free forever',
]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [checked, setChecked] = useState(false)
  const pathname = usePathname()
  // These paths are open to anonymous users (SignupGate handles them after 3 scans)
  const isOpenPath = pathname.startsWith('/detect') || 
                     pathname.startsWith('/chat') ||
                     pathname.startsWith('/scraper') ||
                     pathname.startsWith('/pipeline')

  useEffect(() => {
    // Small delay to let Clerk initialize — avoids flash of modal for logged-in users
    const t = setTimeout(() => setChecked(true), 400)
    return () => clearTimeout(t)
  }, [])

  // Open paths don't need auth — render immediately
  if (isOpenPath) return <>{children}</>

  // Still loading — render children silently (Clerk is initializing)
  if (!checked || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Aiscern" width={56} height={38}
            className="object-contain drop-shadow-[0_0_12px_rgba(245,100,0,0.5)] animate-pulse" />
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    )
  }

  // Authenticated — render page normally
  if (user) return <>{children}</>

  // Not authenticated — show sign-in popup (non-dismissible)
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="relative w-full max-w-md z-10"
        >
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-orange-400 to-amber-400 rounded-t-2xl" />

          <div className="bg-surface border border-white/10 rounded-b-2xl shadow-2xl shadow-primary/20 p-8 space-y-6">

            {/* Logo + heading */}
            <div className="text-center space-y-3">
              <Link href="/">
                <Image src="/logo.png" alt="Aiscern" width={72} height={50}
                  className="mx-auto object-contain drop-shadow-[0_0_16px_rgba(245,100,0,0.5)]" />
              </Link>
              <h1 className="text-2xl font-black text-text-primary">
                Sign in to <span className="gradient-text">Aiscern</span>
              </h1>
              <p className="text-text-muted text-sm leading-relaxed">
                Create a free account to access the dashboard and all AI detection tools — no credit card, no limits.
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

            {/* CTA Buttons */}
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
                  <Lock className="w-4 h-4" />
                  Already have an account? Sign In
                </button>
              </SignInButton>
            </div>

            {/* Trust note */}
            <p className="text-center text-xs text-text-disabled flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald" />
              Free forever · No credit card · 285,000+ training samples
            </p>

            {/* Continue without account link */}
            <p className="text-center text-xs text-text-disabled">
              <Link href="/detect/text" className="text-primary/70 hover:text-primary underline transition-colors">
                Try the text detector without signing in →
              </Link>
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
