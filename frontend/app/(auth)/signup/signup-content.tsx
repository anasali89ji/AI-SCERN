'use client'
import { Suspense, useEffect, useState } from 'react'
import { SignUp, useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { clerkAppearance } from '@/components/auth/clerkAppearance'

function SignupContent() {
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
    <AuthShell mode="signup">
      {/* Same shared shell + appearance as /login — see login-content.tsx. */}
      <SignUp
        routing="path"
        path="/signup"
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl="/dashboard"
        signInUrl="/login"
        appearance={clerkAppearance}
      />
    </AuthShell>
  )
}

export default function SignupContentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#04040f' }}>
        <LoaderCircle className="w-8 h-8 animate-spin" style={{ color: '#4b82f7' }} />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
