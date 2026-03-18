'use client'
import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
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

      <SignIn
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/signup"
      />

      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
        No account?{' '}
        <Link href="/detect/text" style={{ color: '#7c3aed', textDecoration: 'underline' }}>
          Use Aiscern free without signing in →
        </Link>
      </p>
    </div>
  )
}
