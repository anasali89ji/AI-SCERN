import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Manage your Aiscern detection credits and view usage.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
