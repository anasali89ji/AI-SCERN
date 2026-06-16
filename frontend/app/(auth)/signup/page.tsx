'use client'
import { Suspense }           from 'react'
import { useEffect, useState } from 'react'
import { SignUp, useAuth }    from '@clerk/nextjs'
import { useRouter }          from 'next/navigation'
import { Loader2 }            from 'lucide-react'
import Link                   from 'next/link'
import { AuthShell }          from '@/components/auth/AuthShell'
import { clerkAppearance }    from '@/components/auth/clerkAppearance'

function SignUpContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn) { setRedirecting(true); router.replace('/dashboard') }
  }, [isLoaded, isSignedIn, router])

  if (redirecting) return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400">Setting up your account…</p>
      </div>
    </div>
  )

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start detecting AI content for free"
      badge="Free · No credit card"
      badgeDotColor="blue"
      variant="signup"
      extraFooter={
        <p className="mt-4 text-[11.5px] text-slate-500 text-center max-w-[320px]">
          By signing up you confirm you are 13+ years old (16 in EU/EEA) and agree to our{' '}
          <Link href="/terms"   className="underline underline-offset-2 hover:text-slate-400 transition-colors">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-400 transition-colors">Privacy Policy</Link>.
        </p>
      }
    >
      <SignUp
        routing="path"
        path="/signup"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        signInUrl="/login"
        appearance={clerkAppearance}
      />
    </AuthShell>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  )
}
