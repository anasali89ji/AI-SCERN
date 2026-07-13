'use client'
import { Suspense, useEffect, useState } from 'react'
import { SignIn, useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ShieldCheck, Zap, Lock } from 'lucide-react'

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Free forever'    },
  { icon: Zap,         label: 'Instant results' },
  { icon: Lock,        label: 'No data stored'  },
]

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
    <div className="min-h-screen bg-surface-deep flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm text-silver-600">Redirecting to dashboard…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* Left panel — brand (Module 5.1: split screen) */}
      <div className="lg:w-1/2 bg-surface-deep flex flex-col justify-center px-6 py-10 lg:px-16 lg:py-0 border-b lg:border-b-0 lg:border-r border-white/5">
        <Link href="/" className="flex items-center gap-2 mb-6 lg:mb-10 group w-fit" aria-label="Aiscern home">
          <span className="text-xl font-semibold text-silver-900 tracking-tight group-hover:text-accent transition-colors duration-300">
            Aiscern
          </span>
        </Link>
        <h1 className="hidden lg:block text-headline text-silver-700 max-w-md">
          The standard for content authenticity.
        </h1>
        <div className="hidden lg:flex items-center gap-3 mt-10 flex-wrap">
          {TRUST_PILLS.map(({ icon: Icon, label }) => (
            <span key={label}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-silver-600
                         bg-surface border border-white/10 px-3 py-1.5 rounded-full">
              <Icon className="w-3.5 h-3.5 text-accent" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="lg:w-1/2 bg-surface-deep flex flex-col items-center justify-center px-4 py-10 lg:py-0">
        <div className="w-full max-w-[420px]">
          {/* Custom header */}
          <div className="bg-surface-deep border border-white/10 border-b-0 rounded-t-xl px-7 pt-7 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase
                               text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Secure sign in
              </span>
            </div>
            <h2 className="text-silver-900 font-semibold text-2xl tracking-tight">Welcome back</h2>
            <p className="text-silver-600 text-sm mt-1.5">Sign in to your Aiscern account</p>
          </div>

          {/* Clerk widget — theming is done through the appearance API since
              the form fields themselves are rendered by Clerk, not by us.
              (Deviation from spec 5.1: per-field stagger animation, a 3-step
              flow, and a password-strength meter are not reachable through
              this API without replacing Clerk with a custom auth form — see
              Module 5 handoff notes.) */}
          <SignIn
            routing="path"
            path="/login"
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/signup"
            appearance={{
              layout: {
                socialButtonsPlacement: 'bottom',
                socialButtonsVariant: 'blockButton',
                showOptionalFields: false,
              },
              // Clerk's `variables` API requires literal color values — it cannot
              // consume Tailwind classes or CSS custom properties. Every value below
              // is copied verbatim from tailwind.config.ts (accent / silver / error /
              // warning / surface tokens), not invented — keeps the rendered widget
              // in lockstep with the design system. See Module 0.1 token-consistency rule.
              variables: {
                colorPrimary:                  '#2BEE34',  // accent.DEFAULT
                colorBackground:               '#0A0A0A',  // surface.deep
                colorInputBackground:          '#141414',  // surface.DEFAULT
                colorInputText:                '#E5E5E5',  // silver.800
                colorText:                     '#E5E5E5',  // silver.800
                colorTextSecondary:            '#A3A3A3',  // silver.700
                colorTextOnPrimaryBackground:  '#0A0A0A',  // surface.deep
                colorNeutral:                  '#2A2A2A',  // silver.400
                colorDanger:                   '#FF4444',  // error
                colorSuccess:                  '#2BEE34',  // accent.DEFAULT
                colorWarning:                  '#FFB800',  // warning
                borderRadius:                  '8px',
                fontFamily:                    'inherit',
                fontSize:                      '14px',
                spacingUnit:                   '16px',
                fontWeight: { normal: 400, medium: 500, bold: 700 },
              },
              elements: {
                rootBox:                   'w-full',
                card:                      'bg-surface-deep border border-white/10 border-t-0 shadow-lift rounded-b-xl overflow-hidden p-0',
                header:                    '!hidden',
                main:                      'px-7 pb-2 pt-6',
                formFieldLabel:            'text-[12px] font-semibold tracking-[0.07em] uppercase text-silver-700',
                formFieldInput:            'w-full bg-surface border border-white/10 text-silver-800 placeholder:text-silver-600 rounded-lg text-sm px-3.5 py-2.5 transition-all duration-300 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
                formFieldAction:           'text-accent hover:text-accent-hover text-xs font-medium transition-colors duration-300',
                formFieldErrorText:        'text-rose-400 text-xs mt-1.5',
                formButtonPrimary:         'w-full bg-accent hover:bg-accent-hover text-surface-deep font-semibold text-sm rounded-lg py-2.5 border-0 transition-colors duration-300 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/50',
                dividerLine:               'bg-white/10',
                dividerText:               'text-silver-600 text-[11px] uppercase tracking-widest',
                socialButtonsBlockButton:  'w-full bg-surface border border-white/10 text-silver-800 rounded-lg hover:border-white/20 hover:text-silver-900 transition-all duration-300 py-2.5 focus-visible:ring-2 focus-visible:ring-accent/50',
                socialButtonsBlockButtonText: 'text-sm font-semibold',
                alert:                     'border rounded-lg px-4 py-3 my-4 bg-rose-500/5 border-rose-500/20',
                alertText:                 'text-rose-400 text-xs leading-relaxed',
                footer:                    'px-7 pt-3 pb-6',
                footerActionText:          'text-silver-600 text-sm',
                footerActionLink:          'text-accent hover:text-accent-hover font-semibold text-sm transition-colors duration-300 ml-1',
                footerPages:               '!hidden',
                spinner:                   'text-accent',
              },
            }}
          />
        </div>

        {/* Trust pills (mobile only — desktop shows them in the left panel) */}
        <div className="flex lg:hidden items-center gap-3 mt-6 flex-wrap justify-center">
          {TRUST_PILLS.map(({ icon: Icon, label }) => (
            <span key={label}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-silver-600
                         bg-surface border border-white/10 px-3 py-1.5 rounded-full">
              <Icon className="w-3.5 h-3.5 text-accent" />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-5 text-xs text-silver-500">© 2026 Aiscern · Secured by Clerk</p>
      </div>
    </div>
  )
}

export default function LoginContentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-deep flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
