'use client'

import { Suspense }                     from 'react'
import { useEffect, useState }          from 'react'
import { SignUp, useAuth, useSignUp }   from '@clerk/nextjs'
import { useRouter, useSearchParams }   from 'next/navigation'
import { Loader2 }                      from 'lucide-react'
import Link                             from 'next/link'
import { AuthShell }                    from '@/components/auth/AuthShell'
import { clerkAppearance }              from '@/components/auth/clerkAppearance'

function SignUpContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const { signUp }    = useSignUp()
  const router        = useRouter()
  const searchParams  = useSearchParams()
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
        <p style={{ color: '#3e3e6e', fontSize: '13px' }}>Setting up your workspace…</p>
      </div>
    )
  }

  // Clerk pauses a sign-up with status "missing_requirements" once someone
  // has authenticated (e.g. via the Google button) but a required field —
  // username, once enabled as required in the Clerk Dashboard — hasn't been
  // collected yet. It's still the same <SignUp/>, same /signup route, same
  // embedded form: no separate screen or extra redirect to build or wire up.
  // We just re-skin the card header so it reads as "last step", not a
  // second, unrelated "Create your account" screen.
  const needsUsername = signUp?.status === 'missing_requirements'
    && (signUp?.missingFields ?? []).includes('username')

  return (
    <AuthShell
      mode="signup"
      badge={needsUsername ? 'Step 2 of 2' : undefined}
      titleOverride={needsUsername ? 'Pick a username' : undefined}
      subtitleOverride={needsUsername ? "One last step — this is how you'll show up on Aiscern." : undefined}
      extraFooter={
        <p
          className="text-center mt-4 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11.5px', maxWidth: '380px', margin: '16px auto 0' }}
        >
          By creating an account you agree to our{' '}
          <Link
            href="/terms"
            className="underline underline-offset-2 transition-colors duration-150"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-2 transition-colors duration-150"
            style={{ color: 'rgba(255,255,255,0.5)' }}
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
        forceRedirectUrl={redirectUrl}
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
