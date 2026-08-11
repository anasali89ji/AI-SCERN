import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Verification API — Enterprise REST API for Developers',
  description: 'Integrate enterprise AI trust and content verification into your app via REST API. Verify AI text, deepfake images, voice cloning and synthetic video. JSON responses.',
  keywords: [
    'ai verification api','chatgpt detection api','deepfake detection api',
    'ai content verification api','rest api ai verification','ai checker api',
    'openai content detection api','enterprise ai verification api',
  ],
  alternates: { canonical: 'https://aiscern.com/docs/api' },
  openGraph: {
    title: 'Enterprise AI Verification REST API — Text, Images, Audio, Video | Aiscern',
    description: 'Add enterprise AI trust verification to your app in minutes. Verify ChatGPT text, Midjourney images, ElevenLabs voice.',
    url: 'https://aiscern.com/docs/api',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
