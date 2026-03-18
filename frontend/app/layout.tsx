import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthProvider } from '@/components/auth-provider'
import { Toaster } from 'sonner'
import './globals.css'

// preload:false + fallback prevents the build failing when Google Fonts is unreachable
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://aiscern.com'),
  title: {
    default: 'Aiscern — Free AI Detector for Text, Images, Audio & Deepfakes',
    template: '%s | Aiscern',
  },
  description:
    'Detect AI-generated text, deepfakes, synthetic images, audio and video in seconds. Free. Trained on 285,000+ samples. No signup required.',
  keywords: [
    'ai detector','ai text detector','deepfake detector','chatgpt detector',
    'ai content detector','detect ai generated text','deepfake detector online',
    'ai image detector','voice cloning detector','ai audio detector',
    'detect midjourney image','detect dall-e','elevenlabs detector',
    'ai writing detector','free ai detector','ai generated content checker',
    'synthetic media detector','detect stable diffusion','aiscern',
    'is this ai generated','ai face detector','ai video detector',
  ],
  authors: [{ name: 'Anas Ali', url: 'https://aiscern.com' }],
  creator: 'Anas Ali',
  publisher: 'Aiscern',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-logo.png', type: 'image/png', sizes: '256x256' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://aiscern.com',
    siteName: 'Aiscern',
    title: 'Aiscern — Free AI Detector for Text, Images, Audio & Deepfakes',
    description: 'Detect AI-generated content in seconds. 94% accuracy. Free. No signup required.',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Aiscern AI Content Detector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aiscern — Free AI Content Detector',
    description: 'Detect AI text, deepfakes & voice cloning. Free. 285k+ samples.',
    images: ['/logo.png'],
    creator: '@aiscern',
    site: '@aiscern',
  },
  alternates: { canonical: 'https://aiscern.com' },
  category: 'technology',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-text-primary antialiased">
        <ClerkProvider dynamic>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
