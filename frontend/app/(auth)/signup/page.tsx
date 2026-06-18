'use client'

import { Suspense }          from 'react'
import { useEffect, useState } from 'react'
import { SignUp, useAuth }   from '@clerk/nextjs'
import { useRouter }         from 'next/navigation'
import { Loader2 }           from 'lucide-react'
import Link                  from 'next/link'
import { AuthShell }         from '@/components/auth/AuthShell'
import { clerkAppearance }   from '@/components/auth/clerkAppearance'

function SignUpContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setRedirecting(true)
      router.replace('/dashboard')
    }
  }, [isLoaded, isSignedIn, router])

  if (redirecting) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: '#04040f' }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2563eb' }} />
        <p style={{ color: '#3e3e6e', fontSize: '13px' }}>Setting up your workspace…</p>
      </div>
    )
  }

  return (
    <AuthShell
      mode="signup"
      extraFooter={
        <p
          className="text-center mt-4 leading-relaxed"
          style={{ color: '#26264a', fontSize: '11.5px', maxWidth: '380px', margin: '16px auto 0' }}
        >
          By creating an account you agree to our{' '}
          <Link
            href="/terms"
            className="underline underline-offset-2 transition-colors duration-150"
            style={{ color: '#2e2e58' }}
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-2 transition-colors duration-150"
            style={{ color: '#2e2e58' }}
          >
            Privacy Policy
          </Link>
          . You must be 13 years old or older to use Aiscern.
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
      <SignUpContent />
    </Suspense>
  )
}
