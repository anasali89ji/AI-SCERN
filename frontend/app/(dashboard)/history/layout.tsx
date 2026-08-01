import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verification History',
  description: 'View your past content verification results and analysis history.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
