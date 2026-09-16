'use client'
import { Suspense, useEffect, useState } from 'react'
import { SignIn, useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { clerkAppearance } from '@/components/auth/clerkAppearance'

function LoginContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard'

  useEffect(() => {
    if (isLoaded && isSignedIn) { setRedirecting(true); router.replace(redirectUrl) }
  }, [isLoaded, isSignedIn, router, redirectUrl])

  if (redirecting) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#04040f' }}>
      <div className="flex flex-col items-center gap-3">
        <LoaderCircle className="w-8 h-8 animate-spin" style={{ color: '#4b82f7' }} />
        <p className="text-sm" style={{ color: '#7a82ac' }}>Redirecting to dashboard…</p>
      </div>
    </div>
  )

  return (
    <AuthShell mode="signin">
      {/* Clerk widget — theming lives entirely in the shared clerkAppearance
          config so /login and /signup never drift apart. AuthShell owns the
          card frame/border; the `card` element here stays transparent so
          there is exactly one visible perimeter around the auth surface. */}
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

export default function LoginContentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#04040f' }}>
        <LoaderCircle className="w-8 h-8 animate-spin" style={{ color: '#4b82f7' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
