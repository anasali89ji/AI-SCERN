'use client'
/**
 * AuthModal — Global Clerk modal trigger component.
 * Use this everywhere instead of Links to /login or /signup.
 * 
 * Usage:
 *   <AuthModal mode="signIn">  <button>Sign In</button>  </AuthModal>
 *   <AuthModal mode="signUp">  <button>Get Started</button>  </AuthModal>
 */
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface Props {
  mode: 'signIn' | 'signUp'
  children: React.ReactElement
  className?: string
}

export function AuthModal({ mode, children, className }: Props) {
  const clerk = useClerk() as any
  const router = useRouter()

  const open = () => {
    const opts = { forceRedirectUrl: '/dashboard', fallbackRedirectUrl: '/dashboard' }
    if (mode === 'signIn' && typeof clerk.openSignIn === 'function') {
      clerk.openSignIn(opts)
    } else if (mode === 'signUp' && typeof clerk.openSignUp === 'function') {
      clerk.openSignUp(opts)
    } else {
      // Fallback: navigate to auth page
      router.push(mode === 'signIn' ? '/login' : '/signup')
    }
  }

  return (
    <span className={className} onClick={open} style={{ cursor: 'pointer' }}>
      {children}
    </span>
  )
}
