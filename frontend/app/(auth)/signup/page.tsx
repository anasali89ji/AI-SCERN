'use client'
import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        gap: '1.5rem',
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <Image src="/logo.png" alt="Aiscern" width={44} height={30}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(245,100,0,0.5))' }}
          priority />
        <span style={{ fontSize: '1.5rem', fontWeight: 900, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Aiscern
        </span>
      </Link>

      <SignUp
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        signInUrl="/login"
      />

      <p style={{ fontSize: '0.75rem', color: '#334155', textAlign: 'center', maxWidth: '360px' }}>
        Free forever · No credit card · Scan history saved when signed in
      </p>
    </div>
  )
}
