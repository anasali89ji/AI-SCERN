'use client'
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { SignIn, useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, ShieldCheck, Zap, Lock } from 'lucide-react'

const TRUST_PILLS = [
  { icon: ShieldCheck, label: 'Free forever' },
  { icon: Zap,         label: 'Instant results' },
  { icon: Lock,        label: 'No data stored' },
]

/* Shared Clerk appearance — blue theme, clean dark card */
const CLERK_APPEARANCE = {
  layout: {
    socialButtonsPlacement: 'bottom' as const,
    socialButtonsVariant: 'blockButton' as const,
    showOptionalFields: false,
  },
  variables: {
    colorPrimary:                 '#2563eb',
    colorBackground:              '#0a0f1e',
    colorInputBackground:         '#060c18',
    colorInputText:               '#f1f5ff',
    colorText:                    '#e8edff',
    colorTextSecondary:           '#94a3b8',
    colorTextOnPrimaryBackground: '#ffffff',
    colorNeutral:                 '#1e2a3a',
    colorDanger:                  '#f87171',
    colorSuccess:                 '#34d399',
    colorWarning:                 '#fbbf24',
    borderRadius:                 '10px',
    fontFamily:                   'inherit',
    fontSize:                     '14px',
    spacingUnit:                  '16px',
    fontWeight: { normal: 400, medium: 500, bold: 700 },
  },
  elements: {
    rootBox:       'w-full',
    card:          'bg-[#0a0f1e] border border-white/8 border-t-0 shadow-[0_32px_80px_rgba(0,0,0,0.7)] rounded-b-2xl overflow-hidden p-0',
    cardBox:       'rounded-b-2xl',
    header:        '!hidden',
    main:          'px-7 pb-2 pt-6',
    formFieldRow:  'mb-4',
    formFieldLabelRow: 'flex items-center justify-between mb-2',
    formFieldLabel: 'text-[12px] font-semibold tracking-[0.07em] uppercase text-slate-300',
    formFieldHintText: 'text-slate-400 text-[12px] mt-1.5',
    formFieldInput: 'w-full bg-[#060c18] border border-white/8 text-[#f1f5ff] placeholder:text-slate-600 rounded-[10px] text-[14px] px-3.5 py-2.5 transition-all duration-150 focus:outline-none focus:border-blue-500/60 focus:bg-[#070e1f] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] hover:border-white/15',
    formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-300 transition-colors pr-1',
    formFieldAction: 'text-blue-400 hover:text-blue-300 text-[12px] font-medium transition-colors',
    formFieldErrorText: 'text-rose-400 text-[12.5px] mt-2 font-medium',
    formFieldSuccessText: 'text-emerald-400 text-[12.5px] mt-2 font-medium',
    formFieldWarningText: 'text-amber-400 text-[12.5px] mt-2 font-medium',
    otpCodeFieldInput: 'bg-[#060c18] border border-white/8 text-white font-mono text-[20px] font-bold rounded-[10px] text-center w-11 h-12 focus:outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] transition-all duration-150',
    formButtonPrimary: 'w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-[14px] rounded-[10px] py-[11px] border-0 shadow-[0_4px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_6px_28px_rgba(37,99,235,0.45)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
    formButtonReset: 'text-blue-400 hover:text-blue-300 text-[13px] font-medium transition-colors',
    dividerRow:   'my-5',
    dividerLine:  'bg-white/8',
    dividerText:  'text-slate-500 text-[11px] px-3 uppercase tracking-widest',
    socialButtonsBlockButton: 'w-full bg-white/4 border border-white/8 text-slate-200 rounded-[10px] hover:bg-white/8 hover:border-white/15 hover:text-white transition-all duration-200 py-2.5 shadow-sm',
    socialButtonsBlockButtonText: 'text-[13.5px] font-semibold',
    socialButtonsBlockButtonArrow: 'hidden',
    socialButtonsProviderIcon: 'w-4 h-4',
    alert: 'border rounded-[10px] px-4 py-3 my-4 bg-rose-500/8 border-rose-500/30',
    alertText: 'text-rose-300 leading-relaxed text-[13px]',
    alertTextDanger: 'text-rose-300 text-[13px]',
    alertTextWarning: 'text-amber-300 text-[13px]',
    footer: 'px-7 pt-3 pb-6',
    footerAction: 'text-center',
    footerActionText: 'text-slate-400 text-[13.5px]',
    footerActionLink: 'text-blue-400 hover:text-blue-300 font-semibold text-[13.5px] transition-colors ml-1 hover:underline underline-offset-2',
    footerPages: '!hidden',
    identityPreviewText: 'text-slate-200 text-[14px]',
    identityPreviewEditButton: 'text-blue-400 hover:text-blue-300 text-[13px] transition-colors',
    spinner: 'text-blue-400',
    alternativeMethodsBlockButton: 'w-full bg-white/4 border border-white/8 text-slate-200 rounded-[10px] hover:bg-white/8 hover:border-white/15 hover:text-white transition-all duration-200 py-2.5 text-[13px] font-medium',
  },
}

function LoginContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard'

  useEffect(() => {
    if (isLoaded && isSignedIn) { setRedirecting(true); router.replace(redirectUrl) }
  }, [isLoaded, isSignedIn, router, redirectUrl])

  if (redirecting) return (
    <div className="min-h-screen bg-[#06090f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#06090f] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background — minimal dark grid + single blue accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
            backgroundSize: '56px 56px'
          }} />
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(37,99,235,0.06) 0%, transparent 70%)' }} />
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, #06090f 100%)' }} />
      </div>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8 relative z-10 group">
        <Image src="/logo.png" alt="Aiscern" width={32} height={22}
          className="object-contain drop-shadow-[0_0_10px_rgba(245,100,0,0.5)] group-hover:drop-shadow-[0_0_16px_rgba(245,100,0,0.7)] transition-all duration-300" priority />
        <span className="text-xl font-black gradient-text tracking-tight">Aiscern</span>
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[400px]">

        {/* Header */}
        <div className="bg-[#0a0f1e] border border-white/8 border-b-0 rounded-t-2xl px-7 pt-6 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-blue-300 bg-blue-500/8 border border-blue-500/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Secure sign in
            </span>
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight">Welcome back</h1>
          <p className="text-slate-400 text-[13px] mt-1 leading-relaxed">Sign in to your Aiscern account</p>
        </div>

        {/* Clerk widget */}
        <SignIn
          routing="path"
          path="/login"
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl="/dashboard"
          signUpUrl="/signup"
          appearance={CLERK_APPEARANCE}
        />
      </div>

      {/* Trust pills */}
      <div className="relative z-10 flex items-center gap-2.5 mt-7 flex-wrap justify-center">
        {TRUST_PILLS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-full">
            <Icon className="w-3 h-3 text-blue-500/70" />
            {label}
          </span>
        ))}
      </div>

      <p className="mt-5 text-[11px] text-slate-700 relative z-10">© 2026 Aiscern · Secured by Clerk</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#06090f] flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
