'use client'

import { Suspense }                   from 'react'
import { useEffect, useState }        from 'react'
import { SignIn, useAuth }            from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 }                    from 'lucide-react'
import { AuthShell }                  from '@/components/auth/AuthShell'
import { clerkAppearance }            from '@/components/auth/clerkAppearance'

function LoginContent() {
  const { isSignedIn, isLoaded } = useAuth()
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
    }
  }, [isLoaded, isSignedIn, router, redirectUrl])

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
