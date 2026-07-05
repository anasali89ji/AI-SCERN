'use client'
import { Suspense, useEffect, useState } from 'react'
import { SignUp, useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ShieldCheck, Zap, Lock } from 'lucide-react'

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Free forever'    },
  { icon: Zap,         label: 'Instant results' },
  { icon: Lock,        label: 'No data stored'  },
]

function SignUpContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard'

  useEffect(() => {
    if (isLoaded && isSignedIn) { setRedirecting(true); router.replace(redirectUrl) }
  }, [isLoaded, isSignedIn, router, redirectUrl])

  if (redirecting) return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#2BEE34] animate-spin" />
        <p className="text-sm text-[#6B6B6B]">Setting up your account…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8 group" aria-label="Aiscern home">
        <span className="text-xl font-black text-white tracking-tight group-hover:text-[#2BEE34] transition-colors">
          Aiscern
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-[420px]">
        {/* Custom header */}
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] border-b-0 rounded-t-xl px-7 pt-7 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase
                             text-[#2BEE34] bg-[#2BEE34]/10 border border-[#2BEE34]/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34]" />
              Free access
            </span>
          </div>
          <h1 className="text-white font-bold text-2xl tracking-tight">Create your account</h1>
          <p className="text-[#6B6B6B] text-sm mt-1.5">Join Aiscern — AI detection, completely free</p>
        </div>

        {/* Clerk widget */}
        <SignUp
          routing="path"
          path="/signup"
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl="/dashboard"
          signInUrl="/login"
          appearance={{
            layout: {
              socialButtonsPlacement: 'bottom',
              socialButtonsVariant: 'blockButton',
              showOptionalFields: false,
            },
            variables: {
              colorPrimary:                  '#2BEE34',
              colorBackground:               '#0A0A0A',
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
              card:                      'bg-[#0A0A0A] border border-[#2A2A2A] border-t-0 shadow-[0_32px_80px_rgba(0,0,0,0.8)] rounded-b-xl overflow-hidden p-0',
              header:                    '!hidden',
              main:                      'px-7 pb-2 pt-6',
              formFieldLabel:            'text-[12px] font-semibold tracking-[0.07em] uppercase text-[#A3A3A3]',
              formFieldInput:            'w-full bg-[#141414] border border-[#2A2A2A] text-[#E5E5E5] placeholder:text-[#6B6B6B] rounded-lg text-sm px-3.5 py-2.5 transition-all focus:outline-none focus:border-[#2BEE34] focus:shadow-[0_0_0_3px_rgba(43,238,52,0.15)]',
              formFieldAction:           'text-[#2BEE34] hover:text-[#4FFF58] text-xs font-medium transition-colors',
              formFieldErrorText:        'text-[#FF4444] text-xs mt-1.5',
              formButtonPrimary:         'w-full bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm rounded-lg py-2.5 border-0 transition-colors disabled:opacity-50',
              dividerLine:               'bg-[#2A2A2A]',
              dividerText:               'text-[#6B6B6B] text-[11px] uppercase tracking-widest',
              socialButtonsBlockButton:  'w-full bg-[#141414] border border-[#2A2A2A] text-[#E5E5E5] rounded-lg hover:border-[#3A3A3A] hover:text-white transition-all py-2.5',
              socialButtonsBlockButtonText: 'text-sm font-semibold',
              alert:                     'border rounded-lg px-4 py-3 my-4 bg-[#FF4444]/5 border-[#FF4444]/20',
              alertText:                 'text-[#FF4444] text-xs leading-relaxed',
              footer:                    'px-7 pt-3 pb-6',
              footerActionText:          'text-[#6B6B6B] text-sm',
              footerActionLink:          'text-[#2BEE34] hover:text-[#4FFF58] font-semibold text-sm transition-colors ml-1',
              footerPages:               '!hidden',
              spinner:                   'text-[#2BEE34]',
            },
          }}
        />
      </div>

      {/* Trust pills */}
      <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
        {TRUST_PILLS.map(({ icon: Icon, label }) => (
          <span key={label}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B]
                       bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1.5 rounded-full">
            <Icon className="w-3.5 h-3.5 text-[#2BEE34]" />
            {label}
          </span>
        ))}
      </div>

      <p className="mt-5 text-xs text-[#3A3A3A]">© 2026 Aiscern · Secured by Clerk</p>
    </div>
  )
}

export default function SignUpContentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2BEE34] animate-spin" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  )
}
