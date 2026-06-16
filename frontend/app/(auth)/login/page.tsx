'use client'
import { Suspense }           from 'react'
import { useEffect, useState } from 'react'
import { SignIn, useAuth }    from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 }            from 'lucide-react'
import { AuthShell }          from '@/components/auth/AuthShell'
import { clerkAppearance }    from '@/components/auth/clerkAppearance'

function LoginContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const redirectUrl  = searchParams.get('redirect_url') || '/dashboard'

  useEffect(() => {
    if (isLoaded && isSignedIn) { setRedirecting(true); router.replace(redirectUrl) }
  }, [isLoaded, isSignedIn, router, redirectUrl])

  if (redirecting) return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400">Redirecting to dashboard…</p>
      </div>
    </div>
  )

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Aiscern account"
      badge="Secure sign in"
      badgeDotColor="emerald"
      variant="signin"
    >
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
    <Suspense fallback={
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
