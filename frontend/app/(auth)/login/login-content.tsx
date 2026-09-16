'use client'

import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { SignIn, useAuth } from '@clerk/nextjs'
import { ShieldCheck, Zap, Lock } from 'lucide-react'
import { useEffect } from 'react'

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Enterprise Security' },
  { icon: Zap,         label: 'Instant Analysis'    },
  { icon: Lock,        label: 'No data stored'      },
]

const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'bottom' as const,
    socialButtonsVariant:   'blockButton' as const,
    showOptionalFields:     false,
  },
  variables: {
    colorPrimary:                  '#2BEE34',
    colorBackground:               'transparent',
    colorInputBackground:          '#141414',
    colorInputText:                '#E5E5E5',
    colorText:                     '#E5E5E5',
    colorTextSecondary:            '#A3A3A3',
    colorTextOnPrimaryBackground:  '#0A0A0A',
    colorNeutral:                  '#2A2A2A',
    colorDanger:                   '#FF4444',
    colorSuccess:                  '#2BEE34',
    colorWarning:                  '#FFB800',
    borderRadius:                  '8px',
    fontFamily:                    'inherit',
    fontSize:                      '14px',
    spacingUnit:                   '16px',
    fontWeight: { normal: 400, medium: 500, bold: 700 },
  },
  elements: {
    rootBox:                   'w-full',
    card:                      'bg-transparent border-none shadow-none rounded-none p-0 m-0',
    header:                    '!hidden',
    main:                      'px-7 pb-2 pt-6',
    formFieldLabel:            'text-[12px] font-semibold tracking-[0.07em] uppercase text-silver-700',
    formFieldInput:            'w-full bg-surface border border-white/20 text-silver-800 placeholder:text-silver-600 rounded-lg text-[16px] sm:text-sm px-3.5 py-3 sm:py-2.5 transition-all duration-300 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
    formFieldAction:           'text-accent hover:text-accent-hover text-xs font-medium transition-colors duration-300',
    formFieldErrorText:        'text-rose-400 text-xs mt-1.5',
    formButtonPrimary:         'w-full bg-accent hover:bg-accent-hover text-surface-deep font-semibold text-sm rounded-lg py-2.5 border-0 transition-colors duration-300 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/50',
    dividerLine:               'bg-white/10',
    dividerText:               'text-silver-600 text-[11px] uppercase tracking-widest',
    socialButtonsBlockButton:  'w-full bg-surface border border-white/20 text-silver-800 rounded-lg hover:border-white/20 hover:text-silver-900 transition-all duration-300 py-2.5 focus-visible:ring-2 focus-visible:ring-accent/50',
    socialButtonsBlockButtonText: 'text-sm font-semibold',
    alert:                     'border rounded-lg px-4 py-3 my-4 bg-rose-500/5 border-rose-500/20',
    alertText:                 'text-rose-400 text-xs leading-relaxed',
    footer:                    'px-7 pt-3 pb-6',
    footerActionText:          'text-silver-600 text-sm',
    footerActionLink:          'text-accent hover:text-accent-hover font-semibold text-sm transition-colors duration-300 ml-1',
    footerPages:               '!hidden',
    spinner:                   'text-accent',
  },
}

export default function LoginContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl  = searchParams.get('redirect_url') || '/dashboard'

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push(redirectUrl)
    }
  }, [isLoaded, isSignedIn, redirectUrl, router])

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lg:w-1/2 bg-surface-deep flex flex-col justify-center px-6 py-10 lg:px-16 lg:py-0 border-b lg:border-b-0 lg:border-r border-white/15">
        <Link href="/" className="flex items-center gap-2 mb-6 lg:mb-10 group w-fit" aria-label="Aiscern home">
          <span className="text-xl font-semibold text-silver-900 tracking-tight group-hover:text-accent transition-colors duration-300">
            AISCERN
          </span>
        </Link>

        <h1 className="text-3xl lg:text-4xl font-bold text-silver-900 tracking-tight mb-4">
          Verify truth in media
        </h1>
        <p className="text-silver-600 text-base mb-8 max-w-md">
          Detect synthetic media, audio deepfakes, and manipulated documents with multi-modal AI verification.
        </p>

        <div className="hidden lg:flex flex-wrap gap-3">
          {TRUST_PILLS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-white/10 text-xs text-silver-700">
              <Icon className="w-3.5 h-3.5 text-accent" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:w-1/2 bg-surface-deep flex flex-col items-center justify-center px-4 py-10 lg:py-0">
        <div className="w-full max-w-[420px]">
          <div className="bg-surface-deep border border-white/20 rounded-xl overflow-hidden">
            <div className="px-7 pt-7 pb-5 border-b border-white/10">
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

            <SignIn
              routing="path"
              path="/login"
              forceRedirectUrl={redirectUrl}
              fallbackRedirectUrl="/dashboard"
              signUpUrl="/signup"
              appearance={clerkAppearance}
            />
          </div>
        </div>

        <div className="flex lg:hidden flex-wrap justify-center gap-3 mt-8">
          {TRUST_PILLS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-white/10 text-xs text-silver-700">
              <Icon className="w-3.5 h-3.5 text-accent" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
