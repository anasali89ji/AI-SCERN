import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — Enterprise AI Verification Platform',
  description: 'Sign in to Aiscern to save your verification history and access all AI trust verification tools.',
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
