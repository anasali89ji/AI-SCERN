import type { Metadata } from 'next'
import localFont from 'next/font/local'
// NOTE: statically imported on purpose — NOT deferred via
// ClerkClientProviderDeferred. The deferred variant (adopted from main)
// wraps the ENTIRE app in next/dynamic({ ssr: false }), which skips
// server-rendering for every page subtree under the provider. Verified at
// runtime: main's production build ships a 184KB homepage HTML shell whose
// only visible text is the skip link — zero SSR content, breaking the
// "primarily server-rendered" requirement and SEO. Clerk's heavy browser
// SDK (clerk.browser, ~256KB) is itself lazy-loaded by ClerkProvider
// internally, so the static import does not block first paint the way the
// deferral comment implied. ClerkClientProviderDeferred.tsx is kept for
// reference; do not re-adopt it without an SSR fix.
import { ClerkClientProvider } from '@/components/ClerkClientProvider'
import { AuthProvider } from '@/components/auth-provider'
import { CookieConsent } from '@/components/CookieConsent'
import { Toaster } from 'sonner'
import './globals.css'
import { MotionProvider } from '@/components/providers/MotionProvider'
import { AnimationPreferenceProvider } from '@/components/AnimationPreferenceContext'

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
    default: 'Aiscern — Enterprise AI Trust & Content Verification Platform',
    template: '%s | Aiscern',
  },
  description: 'Aiscern is an enterprise AI trust and content verification platform for text, image, audio, video, and documents — ensemble-based, benchmark-tested, with a free tier for individuals.',
  keywords: [
    'ai detector','free ai detector','ai text detector','chatgpt detector','claude detector',
    'ai trust platform','enterprise ai verification','ai content verification',
    'content verification platform','ai text verification',
    'gemini detector','ai content detector','detect ai generated text','chatgpt checker',
    'ai writing detector','gpt detector free','is this ai generated','ai checker',
    'deepfake detector','deepfake detector online free','ai image detector',
    'detect midjourney','detect dall-e','stable diffusion detector',
    'ai face detector','deepfake face detector','fake image detector',
    'ai audio detector','voice clone detector','elevenlabs detector',
    'ai voice detector','deepfake audio','synthetic voice detector',
    'ai video detector','deepfake video detector','synthetic media detector',
    'aiscern','ai detection tool','multimodal ai detector','enterprise content authentication',
    'ai trust and safety platform','digital content trust',
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
    title: 'Aiscern — Enterprise AI Trust & Content Verification Platform',
    description: 'Verify authenticity across text, image, audio, video, and documents with an enterprise-grade AI trust and digital verification platform. Ensemble-based, benchmark-tested accuracy.',
    images: [{ url: 'https://aiscern.com/og-image.png', width: 1200, height: 630, alt: 'Aiscern — Enterprise AI Trust & Content Verification Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aiscern — Enterprise AI Trust Verification Platform',
    description: 'Verify ChatGPT text, Midjourney images, ElevenLabs voice & deepfake video with an enterprise-grade digital trust verification platform.',
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
        <meta name="theme-color" content="#141414" />

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
        {/* SoftwareApplication schema — site-wide */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Aiscern Enterprise AI Trust & Content Verification Platform',
            operatingSystem: 'Web browser',
            applicationCategory: 'UtilitiesApplication',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            description: 'Enterprise AI trust and content verification platform for text, image, audio, video, and document authenticity.',
            url: 'https://aiscern.com',
            sameAs: [
              'https://twitter.com/aiscern',
              'https://linkedin.com/company/aiscern',
              'https://github.com/anasali89ji/AI-SCERN',
            ],
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.5',
              ratingCount: '100',
            },
          })}}
        />
      </head>
      <body className="bg-background text-silver-800 antialiased">
        {/* Skip to main content — keyboard accessibility */}
        <a
          href="#main-content"
          aria-label="Skip to main content"
          className="skip-link"
        >
          Skip to main content
        </a>
        <ClerkClientProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''}
        >
          <AuthProvider>
            <AnimationPreferenceProvider>
              <MotionProvider>
                {children}
                <Toaster richColors position="top-right" />
                <CookieConsent />
              </MotionProvider>
            </AnimationPreferenceProvider>
          </AuthProvider>
        </ClerkClientProvider>
      </body>
    </html>
  )
}