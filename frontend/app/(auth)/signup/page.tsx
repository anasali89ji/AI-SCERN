'use client'
import { useEffect } from 'react'
import { SignUpButton, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Zap, CheckCircle, Shield, ArrowRight } from 'lucide-react'

const PERKS = [
  'Scan history saved automatically',
  'All 6 detection tools — unlimited',
  'Batch scan up to 20 files at once',
  'AI Detection Assistant (chat)',
  'Free forever — no credit card ever',
]

export default function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard')
  }, [isLoaded, isSignedIn, router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6 z-10">
        {/* Logo */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5 justify-center">
            <Image src="/logo.png" alt="Aiscern" width={52} height={36}
              className="object-contain drop-shadow-[0_0_12px_rgba(245,100,0,0.5)]" priority />
            <span className="text-2xl font-black gradient-text">Aiscern</span>
          </Link>
          <h1 className="text-2xl font-black text-text-primary">Create your free account</h1>
          <p className="text-text-muted text-sm">Join thousands detecting AI content with Aiscern</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 space-y-6 shadow-2xl shadow-primary/10">
          {/* Perks */}
          <ul className="space-y-2.5">
            {PERKS.map(p => (
              <li key={p} className="flex items-center gap-2.5 text-sm text-text-secondary">
                <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>

          {/* Sign Up Button — opens Clerk modal */}
          <SignUpButton mode="modal" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
            <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all active:scale-95">
              <Zap className="w-4 h-4" />
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </button>
          </SignUpButton>

          {/* Or Google */}
          <p className="text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign in →
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-text-disabled flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald" />
          No credit card · No limits · Free forever
        </p>

        <p className="text-center text-xs">
          <Link href="/detect/text" className="text-text-disabled hover:text-primary transition-colors">
            Try without an account →
          </Link>
        </p>
      </div>
    </div>
  )
}
