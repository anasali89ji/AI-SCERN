import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reviews — Real User Ratings & Testimonials',
  description: 'Read reviews of Aiscern\u2019s enterprise AI trust verification platform from editors, researchers and developers.',
  keywords: ['aiscern review','ai verification platform review','best ai verification platform 2025','aiscern testimonials','ai content verification reviews'],
  alternates: { canonical: 'https://aiscern.com/reviews' },
  openGraph: {
    title: 'Aiscern Reviews — What Users Say About Our AI Verification Platform',
    description: 'Real feedback from users about Aiscern\u2019s enterprise AI trust verification platform.',
    url: 'https://aiscern.com/reviews',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
