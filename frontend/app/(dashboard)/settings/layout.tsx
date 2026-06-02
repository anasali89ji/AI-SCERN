import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Update your Aiscern account preferences and notification settings.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
