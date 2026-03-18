'use client'
import { useEffect, useState } from 'react'
import { useClerk, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Zap, CheckCircle, Shield, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { openSignIn, loaded } = useClerk() as any
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const [opening, setOpening] = useState(false)

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard')
  }, [isLoaded, isSignedIn, router])

  // Auto-open modal when Clerk is ready
  useEffect(() => {
    if (isLoaded && !isSignedIn && typeof openSignIn === 'function') {
      setTimeout(() => {
        try {
          openSignIn({ forceRedirectUrl: '/dashboard', fallbackRedirectUrl: '/dashboard' })
        } catch (e) {
          console.error('openSignIn failed:', e)
        }
      }, 300)
    }
  }, [isLoaded, isSignedIn]) // eslint-disable-line

  const handleSignIn = () => {
    setOpening(true)
    if (typeof openSignIn === 'function') {
      try {
        openSignIn({ forceRedirectUrl: '/dashboard', fallbackRedirectUrl: '/dashboard' })
      } catch (e) {
        console.error('openSignIn failed:', e)
      }
    }
    setTimeout(() => setOpening(false), 2000)
  }

  const handleSignUp = () => {
    router.push('/signup')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/5 blur-[80px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10 space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 justify-center mb-4">
            <Image src="/logo.png" alt="Aiscern" width={56} height={38}
              className="object-contain drop-shadow-[0_0_16px_rgba(245,100,0,0.6)]" priority />
            <span className="text-2xl font-black gradient-text">Aiscern</span>
          </Link>
          <h1 className="text-3xl font-black text-text-primary mb-2">Welcome back</h1>
          <p className="text-text-muted text-sm">Sign in to your dashboard and scan history</p>
        </div>

        {/* Main card */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
          {/* Top gradient bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-orange-400 to-amber-400" />
          
          <div className="p-8 space-y-5">
            {/* Perks */}
            <ul className="space-y-2">
              {[
                'Save complete scan history',
                'All 6 detection tools — unlimited',
                'Batch scan 20 files at once',
                'AI Detection Assistant',
                'Free forever — no credit card',
              ].map(p => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />{p}
                </li>
              ))}
            </ul>

            {/* Primary Sign In button */}
            <button
              onClick={handleSignIn}
              disabled={opening}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-70"
            >
              {opening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {opening ? 'Opening...' : 'Sign In to Aiscern'}
            </button>

            {/* Google button */}
            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-white/5 text-text-primary text-sm font-semibold hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="text-center text-sm text-text-muted">
              No account?{' '}
              <button onClick={handleSignUp} className="text-primary hover:underline font-semibold">
                Create one free →
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-disabled flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald" />
          Free forever · No credit card · 285,000+ training samples
        </p>
      </div>
    </div>
  )
}
