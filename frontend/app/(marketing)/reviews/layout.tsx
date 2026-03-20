import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aiscern Reviews — Real User Ratings & Testimonials',
  description: 'Read reviews of Aiscern AI detection tools from editors, researchers and developers.',
  keywords: ['aiscern review','ai detector review','best ai detector 2025','aiscern testimonials','ai content detector reviews'],
  alternates: { canonical: 'https://aiscern.com/reviews' },
  openGraph: {
    title: 'Aiscern Reviews — What Users Say About Our AI Detector',
    description: 'Real feedback from users about Aiscern AI detection tools.',
    url: 'https://aiscern.com/reviews',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
