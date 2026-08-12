'use client'

import { Suspense }                   from 'react'
import { useEffect, useState }        from 'react'
import { SignIn, useAuth, useClerk }  from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 }                    from 'lucide-react'
import { AuthShell }                  from '@/components/auth/AuthShell'
import { clerkAppearance }            from '@/components/auth/clerkAppearance'

function LoginContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const { client, setActive }    = useClerk()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)

  const redirectUrl = (() => {
    const raw = searchParams.get('redirect_url') ?? ''
    // Only allow same-origin redirects
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw
    return '/dashboard'
  })()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setRedirecting(true)
      router.replace(redirectUrl)

      const fallback = setTimeout(() => {
        if (window.location.pathname !== redirectUrl) {
          window.location.href = redirectUrl
        }
      }, 2000)
      return () => clearTimeout(fallback)
    }
  }, [isLoaded, isSignedIn, router, redirectUrl])

  // Direct fix for "Continue spins forever after password reset": the
  // previous fallback above waited for useAuth().isSignedIn to flip before
  // doing anything. On the password-reset path specifically (email code ->
  // new password -> complete), Clerk's internal <SignIn/> step tree creates
  // the session (client.signIn.createdSessionId) but there are cases where
  // that never gets promoted to the active session — isSignedIn simply
  // never flips true, so the effect above never even fires. Poll Clerk's
  // own client object directly and, the moment a session has been created
  // by the reset flow but isn't yet the active one, call setActive()
  // ourselves instead of waiting on a signal that may never come.
  useEffect(() => {
    if (!isLoaded || isSignedIn || redirecting) return

    const interval = setInterval(async () => {
      const createdSessionId = client?.signIn?.createdSessionId
      if (!createdSessionId) return

      clearInterval(interval)
      try {
        await setActive({ session: createdSessionId })
      } catch (err) {
        console.error('[login] setActive fallback failed:', err)
      } finally {
        window.location.href = redirectUrl
      }
    }, 500)

    // Give the normal Clerk flow a window to complete on its own before
    // this fallback takes over.
    const timeout = setTimeout(() => clearInterval(interval), 8000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [isLoaded, isSignedIn, redirecting, client, setActive, redirectUrl])

  if (redirecting) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: '#04040f' }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2563eb' }} />
        <p style={{ color: '#3e3e6e', fontSize: '13px' }}>Redirecting to dashboard…</p>
      </div>
    )
  }

  return (
    <AuthShell mode="signin">
      <SignIn
        routing="path"
        path="/login"
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/signup"
        appearance={clerkAppearance}
      />
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: '#04040f' }}
        >
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2563eb' }} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
