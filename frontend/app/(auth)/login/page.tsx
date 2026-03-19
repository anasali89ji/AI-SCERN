'use client'
import { useEffect } from 'react'
import { SignIn, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard')
  }, [isLoaded, isSignedIn, router])

  return (
    <div className="min-h-screen bg-[#06060e] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-violet-600/8 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-600/6 blur-[120px] pointer-events-none" />

      {/* Logo — minimal top */}
      <Link href="/" className="flex items-center gap-2.5 mb-8 relative z-10">
        <Image src="/logo.png" alt="Aiscern logo" width={40} height={27}
          className="object-contain drop-shadow-[0_0_10px_rgba(245,100,0,0.5)]" priority />
        <span className="text-xl font-black gradient-text">Aiscern</span>
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px]">
        <SignIn
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
          signUpUrl="/signup"
          appearance={{
            variables: {
              colorPrimary:          '#7c3aed',
              colorBackground:       '#0e0e1c',
              colorInputBackground:  '#16162a',
              colorInputText:        '#f1f5f9',
              colorText:             '#f1f5f9',
              colorTextSecondary:    '#94a3b8',
              colorTextOnPrimaryBackground: '#ffffff',
              borderRadius:          '10px',
              fontFamily:            'inherit',
              fontSize:              '14px',
              spacingUnit:           '16px',
            },
            elements: {
              // Outer shell
              rootBox:    'w-full',
              card:       'bg-[#0e0e1c] border border-white/[0.08] shadow-2xl shadow-black/60 rounded-2xl backdrop-blur-xl',
              cardBox:    'rounded-2xl',

              // Header
              headerTitle:    'text-white font-bold text-xl tracking-tight',
              headerSubtitle: 'text-slate-400 text-sm',

              // Social login
              socialButtonsBlockButton:      'bg-white/[0.04] border border-white/[0.08] text-slate-200 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 rounded-xl',
              socialButtonsBlockButtonText:  'text-slate-200 font-medium text-sm',

              // Divider
              dividerLine: 'bg-white/[0.06]',
              dividerText: 'text-slate-600 text-xs',

              // Labels
              formFieldLabel: 'text-slate-400 text-xs font-medium tracking-wide uppercase mb-1',

              // Inputs — grey base + neon glow on focus
              formFieldInput: [
                'bg-[#16162a]',
                'border border-white/[0.08]',
                'text-slate-100',
                'rounded-xl',
                'placeholder:text-slate-600',
                'transition-all duration-200',
                'focus:outline-none',
                'focus:border-violet-500/60',
                'focus:bg-[#1a1a2e]',
                'focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15),0_0_20px_rgba(124,58,237,0.08)]',
                'hover:border-white/[0.14]',
              ].join(' '),

              formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-300',

              // Primary button
              formButtonPrimary: [
                'bg-violet-600',
                'hover:bg-violet-500',
                'text-white',
                'font-semibold',
                'rounded-xl',
                'shadow-lg',
                'shadow-violet-900/40',
                'transition-all',
                'duration-200',
                'hover:shadow-violet-700/30',
                'hover:shadow-xl',
              ].join(' '),

              // Footer
              footerActionLink:  'text-violet-400 hover:text-violet-300 font-medium transition-colors',
              footerActionText:  'text-slate-500',
              footer:            'border-t border-white/[0.05]',

              // Error / alert
              formFieldErrorText: 'text-rose-400 text-xs',
              alertText:          'text-rose-300 text-sm',
              alert:              'bg-rose-500/10 border-rose-500/20 rounded-xl',

              // Identity preview (after email step)
              identityPreviewText:           'text-slate-200',
              identityPreviewEditButton:     'text-violet-400 hover:text-violet-300',
              identityPreviewEditButtonIcon: 'text-violet-400',
            }
          }}
        />
      </div>

      {/* Bottom link */}
      <p className="mt-6 text-xs text-slate-600 relative z-10">
        No account?{' '}
        <Link href="/signup" className="text-violet-400 hover:text-violet-300 transition-colors">
          Sign up free →
        </Link>
      </p>
    </div>
  )
}
