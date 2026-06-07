import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Batch AI Content Analyzer — Analyze 20 Files Simultaneously | Aiscern',
  description: 'Upload and analyze up to 20 files simultaneously. Detect AI-generated text, images, audio, and video in parallel. Free batch AI detection — no credit card required.',
  alternates: { canonical: 'https://aiscern.com/batch' },
  openGraph: {
    title: 'Batch AI Content Analyzer — 20 Files at Once',
    description: 'Analyze up to 20 files simultaneously for AI-generated content across text, image, audio and video.',
    url: 'https://aiscern.com/batch',
    images: [{ url: 'https://aiscern.com/api/og?title=Batch+AI+Content+Analyzer&tool=Batch&color=%232563eb', width: 1200, height: 630 }],
  },
}

export default function BatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
