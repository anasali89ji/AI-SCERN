import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about Aiscern\u2019s enterprise AI trust verification platform: pricing, accuracy, supported file types, API access, and data privacy.',
  alternates: { canonical: 'https://aiscern.com/faq' },
  openGraph: {
    title: 'FAQ — Aiscern Enterprise AI Verification Platform',
    description: 'Answers about Aiscern\u2019s enterprise AI trust verification platform: pricing, accuracy, supported file types, API access, and data privacy.',
    url: 'https://aiscern.com/faq',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
