import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthProvider } from '@/components/auth-provider'
import { Toaster } from 'sonner'
import './globals.css'

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
    default: 'Aiscern — #1 Free AI Detector for Text, Images, Audio & Deepfakes',
    template: '%s | Aiscern — Free AI Detection',
  },
  description: 'The most accurate free AI detector. Detect ChatGPT, Claude, Gemini text, Midjourney deepfakes, ElevenLabs voice clones & synthetic video. 94% accuracy. 285,000+ training samples. No signup required.',
  keywords: [
    'ai detector','free ai detector','ai text detector','chatgpt detector','claude detector',
    'gemini detector','ai content detector','detect ai generated text','chatgpt checker',
    'ai writing detector','gpt detector free','is this ai generated','ai checker',
    'deepfake detector','deepfake detector online free','ai image detector',
    'detect midjourney','detect dall-e','stable diffusion detector',
    'ai face detector','deepfake face detector','fake image detector',
    'ai audio detector','voice clone detector','elevenlabs detector',
    'ai voice detector','deepfake audio','synthetic voice detector',
    'ai video detector','deepfake video detector','synthetic media detector',
    'aiscern','ai detection tool','multimodal ai detector','best ai detector 2025',
  ],
  authors: [{ name: 'Anas Ali', url: 'https://aiscern.com' }],
  creator: 'Anas Ali',
  publisher: 'Aiscern',
  applicationName: 'Aiscern',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-logo.png', type: 'image/png', sizes: '256x256' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
  },
  manifest: '/site.webmanifest',
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website', locale: 'en_US',
    url: 'https://aiscern.com', siteName: 'Aiscern',
    title: 'Aiscern — #1 Free AI Detector for Text, Images, Audio & Deepfakes',
    description: 'Detect AI-generated content in seconds. 94% accuracy on ChatGPT, Claude, Midjourney, ElevenLabs & more. Free. No signup.',
    images: [{ url: 'https://aiscern.com/og-image.png', width: 1200, height: 630, alt: 'Aiscern — Free AI Content Detection Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aiscern — Free AI Detector for Text, Images, Audio & Video',
    description: 'Detect ChatGPT text, Midjourney images, ElevenLabs voice & deepfake video. 94% accuracy. Free.',
    images: ['https://aiscern.com/og-image.png'],
    creator: '@aiscern', site: '@aiscern',
  },
  alternates: { canonical: 'https://aiscern.com' },
  category: 'technology',
  verification: {
    google: 'add-your-google-search-console-verification-here',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="google-site-verification" content="ekcPkUKX1AtBfsRCRULZp5rUgXBRYt60NE4XOFrO5Ds" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className="bg-background text-text-primary antialiased">
        {/* Skip to main content — keyboard accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
          Skip to main content
        </a>
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''}
          signInUrl="/login"
          signUpUrl="/signup"
        >
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}