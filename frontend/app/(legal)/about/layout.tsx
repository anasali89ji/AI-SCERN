import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Aiscern — The Most Accurate Free AI Detector Online',
  description: 'Aiscern is a multi-modal AI detection platform built on 413,000+ training samples from 87 datasets. Detect AI text, deepfakes, voice cloning and synthetic video. Built to make AI detection accessible to everyone.',
  keywords: ['about aiscern','ai detection platform','how ai detector works','aiscern accuracy','ai content detection technology'],
  alternates: { canonical: 'https://aiscern.com/about' },
  openGraph: {
    title: 'About Aiscern — Built on 413,000+ AI Training Samples',
    description: 'How we built the most accurate free AI detector. 413k+ samples, 87 datasets, 85%+ accuracy on text. Free for everyone.',
    url: 'https://aiscern.com/about',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
