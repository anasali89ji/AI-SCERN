import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Web Scanner',
  description: 'Scan web pages for AI-generated content using Aiscern\u2019s enterprise AI verification platform.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
