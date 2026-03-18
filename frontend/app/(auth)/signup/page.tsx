'use client'
import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-5">
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="Aiscern" width={44} height={30}
          className="object-contain drop-shadow-[0_0_10px_rgba(245,100,0,0.5)]" priority />
        <span className="text-2xl font-black gradient-text">Aiscern</span>
      </Link>

      <SignUp
        routing="path"
        path="/signup"
        forceRedirectUrl="/dashboard"
        signInUrl="/login"
        appearance={{
          variables: {
            colorPrimary: '#7c3aed',
            colorBackground: '#0f0f14',
            colorInputBackground: '#1a1a24',
            colorInputText: '#f1f0f5',
            colorText: '#f1f0f5',
            colorTextSecondary: '#9b9aaa',
            borderRadius: '12px',
          },
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-2xl !bg-[#13131a] border border-white/10',
            socialButtonsBlockButton: '!border !border-white/15 !bg-white/5 hover:!bg-white/10 !text-white !font-semibold',
            formButtonPrimary: '!bg-[#7c3aed] hover:!bg-[#6d28d9] !font-semibold',
            footerActionLink: '!text-[#7c3aed]',
            formFieldInput: '!bg-[#1a1a24] !border-white/15 !text-white',
          },
          layout: { socialButtonsPlacement: 'top', showOptionalFields: false },
        }}
      />

      <p className="text-xs text-text-disabled max-w-sm text-center">
        Free forever · No credit card · Scan history saved when signed in
      </p>
    </div>
  )
}
