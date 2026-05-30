import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ClerkClientProvider } from '@/components/ClerkClientProvider'
import { AuthProvider } from '@/components/auth-provider'
import { CookieConsent } from '@/components/CookieConsent'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import './globals.css'

const inter = localFont({
  src: [
    { path: '../public/fonts/inter-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/inter-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://aiscern.com'),
  title: {
    default: 'Aiscern — Free Multi-Modal AI Detection | Text, Image, Audio, Video',
    template: '%s | Aiscern',
  },
  description: 'Free AI content detection for text, images, audio, and video. Ensemble-based analysis with published accuracy benchmarks. Built by Anas Ali in Islamabad.',
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
  authors: [{ name: 'Aiscern', url: 'https://aiscern.com' }],
  creator: 'Aiscern',
  publisher: 'Aiscern',
  applicationName: 'Aiscern',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  },
  manifest: '/site.webmanifest',
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website', locale: 'en_US',
    url: 'https://aiscern.com', siteName: 'Aiscern',
    title: 'Aiscern — Free Multi-Modal AI Detection | Text, Image, Audio, Video',
    description: 'Free AI content detection for text, images, audio, and video. Ensemble-based analysis with published accuracy benchmarks.',
    images: [{ url: 'https://aiscern.com/og-image.png', width: 1200, height: 630, alt: 'Aiscern — Free AI Content Detection Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aiscern — Free AI Detector for Text, Images, Audio & Video',
    description: 'Detect ChatGPT text, Midjourney images, ElevenLabs voice & deepfake video. Ensemble-based. Free tier available.',
    images: ['https://aiscern.com/og-image.png'],
    creator: '@aiscern', site: '@aiscern',
  },
  alternates: { canonical: 'https://aiscern.com' },
  category: 'technology',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="ekcPkUKX1AtBfsRCRULZp5rUgXBRYt60NE4XOFrO5Ds" />
        <meta name="theme-color" content="#0f172a" />

        {/* ── Critical font preloads — must come before CSS to prevent FOIT ── */}
        <link
          rel="preload"
          href="/fonts/inter-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-700.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* ── Preconnect for auth only — HF api is not used on homepage load ── */}
        <link rel="preconnect" href="https://clerk.aiscern.com" />
        <link rel="dns-prefetch" href="https://clerk.aiscern.com" />
        <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
        {/* NOTE: HuggingFace preconnect removed — not used within first 2s */}
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
      </head>
      <body className="bg-background text-text-primary antialiased">
        {/* Skip to main content — keyboard accessibility */}
        <a
          href="#main-content"
          aria-label="Skip to main content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <ClerkClientProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''}
        >
          <AuthProvider>
            <TooltipProvider delayDuration={200}>
              <main id="main-content">
                {children}
              </main>
              <Toaster richColors position="top-right" />
              <CookieConsent />
            </TooltipProvider>
          </AuthProvider>
        </ClerkClientProvider>
      </body>
    </html>
  )
}