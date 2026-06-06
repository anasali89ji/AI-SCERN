'use client'
import { useRouter } from 'next/navigation'

interface Props {
  mode: 'signIn' | 'signUp'
  children: React.ReactElement
  className?: string
}

export function AuthModal({ mode, children, className }: Props) {
  const router = useRouter()

  const open = () => {
    router.push(mode === 'signIn' ? '/login' : '/signup')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={className}
      onClick={open}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer' }}
      aria-label={mode === 'signIn' ? 'Sign in' : 'Sign up'}
    >
      {children}
    </span>
  )
}
