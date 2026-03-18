'use client'
import { useEffect, useState } from 'react'
import { useClerk, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Zap, CheckCircle, Shield, ArrowRight, Loader2 } from 'lucide-react'

export default function SignUpPage() {
  const { openSignUp } = useClerk() as any
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard')
  }, [isLoaded, isSignedIn, router])

  // Auto-open modal when Clerk is ready
  useEffect(() => {
    if (isLoaded && !isSignedIn && typeof openSignUp === 'function') {
      setTimeout(() => {
        try {
          openSignUp({ forceRedirectUrl: '/dashboard', fallbackRedirectUrl: '/dashboard' })
        } catch (e) {
          console.error('openSignUp failed:', e)
        }
      }, 300)
    }
  }, [isLoaded, isSignedIn]) // eslint-disable-line

  const handleSignUp = () => {
    setOpening(true)
    if (typeof openSignUp === 'function') {
      try {
        openSignUp({ forceRedirectUrl: '/dashboard', fallbackRedirectUrl: '/dashboard' })
      } catch (e) {
        console.error('openSignUp failed:', e)
      }
    }
    setTimeout(() => setOpening(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full bg-amber/5 blur-[80px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10 space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 justify-center mb-4">
            <Image src="/logo.png" alt="Aiscern" width={56} height={38}
              className="object-contain drop-shadow-[0_0_16px_rgba(245,100,0,0.6)]" priority />
            <span className="text-2xl font-black gradient-text">Aiscern</span>
          </Link>
          <h1 className="text-3xl font-black text-text-primary mb-2">Create free account</h1>
          <p className="text-text-muted text-sm">Join thousands detecting AI content daily</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-primary via-orange-400 to-amber-400" />

          <div className="p-8 space-y-5">
            <ul className="space-y-2">
              {[
                'Scan history saved automatically',
                'All 6 detection tools — unlimited',
                'Batch scan up to 20 files at once',
                'AI Detection Assistant (chat)',
                'Free forever — no credit card',
              ].map(p => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />{p}
                </li>
              ))}
            </ul>

            <button
              onClick={handleSignUp}
              disabled={opening}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-70"
            >
              {opening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {opening ? 'Opening...' : 'Create Free Account'}
              {!opening && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              onClick={handleSignUp}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-white/5 text-text-primary text-sm font-semibold hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign Up with Google
            </button>

            <div className="text-center text-sm text-text-muted">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-semibold">
                Sign in →
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-disabled flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald" />
          No credit card · No limits · Free forever
        </p>
      </div>
    </div>
  )
}
