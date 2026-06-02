import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Web Scanner',
  description: 'Scan web pages for AI-generated content using the Aiscern web scanner.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
