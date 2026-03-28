'use client'
import { useEffect } from 'react'
import { SignUp, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard')
  }, [isLoaded, isSignedIn, router])

  return (
    <div className="min-h-screen bg-[#06060e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-violet-600/[0.07] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-indigo-600/[0.05] blur-[120px] pointer-events-none" />

      <Link href="/" className="flex items-center gap-2.5 mb-10 relative z-10 group">
        <Image src="/logo.png" alt="Aiscern logo" width={38} height={26}
          className="object-contain drop-shadow-[0_0_12px_rgba(245,100,0,0.55)] group-hover:drop-shadow-[0_0_16px_rgba(245,100,0,0.7)] transition-all" priority />
        <span className="text-xl font-black gradient-text">Aiscern</span>
      </Link>

      <div className="relative z-10 w-full max-w-[400px]">
        <SignUp
          routing="hash"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
          signInUrl="/login"
          appearance={{
            layout: {
              socialButtonsPlacement: 'bottom',
              socialButtonsVariant: 'blockButton',
              showOptionalFields: false,
            },
            variables: {
              colorPrimary: '#7c3aed',
              colorBackground: '#0c0c1d',
              colorInputBackground: '#13132b',
              colorInputText: '#f0f4ff',
              colorText: '#eef2ff',
              colorTextSecondary: '#8892a4',
              colorTextOnPrimaryBackground: '#ffffff',
              colorNeutral: '#334155',
              colorDanger: '#f87171',
              borderRadius: '12px',
              fontFamily: 'inherit',
              fontSize: '14px',
              spacingUnit: '18px',
            },
            elements: {
              rootBox: 'w-full',
              card: 'bg-[#0c0c1d] border border-[#1e1e3a] shadow-[0_32px_64px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] rounded-2xl',
              cardBox: 'rounded-2xl overflow-hidden',
              header: 'pb-2',
              headerTitle: 'text-white font-bold text-[22px] tracking-tight',
              headerSubtitle: 'text-[#8892a4] text-[13px]',
              main: 'px-1',
              formFieldRow: 'mb-1',
              formFieldLabel: 'text-[11px] font-semibold tracking-widest uppercase text-[#5a647a] mb-1.5',
              formFieldInput: 'bg-[#13132b] border border-[#1e1e3a] text-[#eef2ff] placeholder:text-[#3a4055] rounded-xl text-[14px] transition-all duration-200 focus:outline-none focus:bg-[#15153a] focus:border-violet-500/70 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.18),inset_0_0_0_1px_rgba(139,92,246,0.3)]',
              formFieldInputShowPasswordButton: 'text-[#3a4055] hover:text-[#94a3b8] transition-colors',
              formFieldErrorText: 'text-rose-400 text-[12px] mt-1',
              formButtonPrimary: 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold text-[14px] rounded-xl shadow-[0_4px_24px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_32px_rgba(124,58,237,0.45)] transition-all duration-200 border-0',
              dividerRow: 'my-4',
              dividerLine: 'bg-[#1e1e3a]',
              dividerText: 'text-[#3a4055] text-[12px] px-3',
              socialButtonsBlockButton: 'bg-[#11112a] border border-[#1e1e3a] text-[#94a3b8] rounded-xl hover:bg-[#16163a] hover:border-[#2a2a55] hover:text-[#c4cce0] transition-all duration-200',
              socialButtonsBlockButtonText: 'text-[13px] font-medium',
              footer: 'hidden',
              footerAction: 'hidden',
              footerActionLink: 'hidden',
              footerPages: 'hidden',
              alert: 'bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[13px]',
              alertText: 'text-rose-300',
              identityPreviewText: 'text-[#c4cce0]',
              identityPreviewEditButton: 'text-violet-400 hover:text-violet-300 text-[13px]',
            }
          }}
        />
      </div>

      <p className="mt-5 text-[13px] text-[#3a4055] relative z-10">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Sign in →
        </Link>
      </p>
      <p className="mt-3 text-[11px] text-[#252535] relative z-10">© 2026 Aiscern · Secured by Clerk</p>
    </div>
  )
}
