import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | Aiscern — Free AI Detector',
  description: 'Sign in to Aiscern to save your scan history and access all AI detection tools for free.',
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
