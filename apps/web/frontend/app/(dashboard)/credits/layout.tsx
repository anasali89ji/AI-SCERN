import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Manage your Aiscern verification credits and view usage.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
