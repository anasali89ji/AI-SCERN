import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pipeline',
  description: 'Monitor and manage your Aiscern detection pipeline.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
