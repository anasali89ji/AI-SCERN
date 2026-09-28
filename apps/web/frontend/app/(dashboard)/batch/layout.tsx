import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Batch AI Content Verification — Analyze 20 Files Simultaneously',
  description: 'Upload and verify up to 20 files simultaneously. Enterprise AI trust verification for text, images, audio, and video in parallel.',
  alternates: { canonical: 'https://aiscern.com/batch' },
  openGraph: {
    title: 'Batch AI Content Verification — 20 Files at Once',
    description: 'Verify up to 20 files simultaneously for AI-generated content across text, image, audio and video.',
    url: 'https://aiscern.com/batch',
    images: [{ url: 'https://aiscern.com/api/og?title=Batch+AI+Content+Analyzer&tool=Batch&color=%237c3aed', width: 1200, height: 630 }],
  },
}

export default function BatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
