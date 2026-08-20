import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { CookieConsent } from '@/components/CookieConsent'
import { Toaster } from 'sonner'
import './globals.css'
import { MotionProvider } from '@/components/providers/MotionProvider'
import { AnimationPreferenceProvider } from '@/components/AnimationPreferenceContext'
import { Analytics } from '@vercel/analytics/next'

/**
 * Clerk's client bundle (ui-common/vendors/clerk.browser/ui.browser — ~256 KiB
 * uncompressed) was showing up as "reduce unused JavaScript" on marketing
 * pages that never touch auth on first paint. A static import puts that
 * whole chunk in the initial bundle graph even though ClerkClientProvider
 * is itself a 'use client' boundary — 'use client' only affects SSR, not
 * chunking. The dynamic(..., { ssr: false }) that gives it its own async
 * chunk lives in ClerkClientProviderDeferred.tsx: `ssr: false` isn't
 * allowed directly in this file since layout.tsx is a Server Component
 * (it exports `metadata`) — `next build` catches this and fails otherwise.
 */
import { ClerkClientProvider } from '@/components/ClerkClientProviderDeferred'
/**
 * NOT deferred like ClerkClientProvider above, on purpose: AuthGuard.tsx
 * treats "150ms elapsed + loading:false" as a confirmed logged-out state.
 * Deferring this too would widen that race on slow connections and could
 * flash the sign-in wall at real logged-in users. Static import stays.
 */
import { AuthProvider } from '@/components/auth-provider'

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
    'ai trust platform','enterprise ai verification','ai content verification','digital trust verification',
    'content verification platform','ai text verification','chatgpt detector','claude detector',
    'gemini detector','ai content detector','detect ai generated text','chatgpt checker',
    'ai writing verification','is this ai generated','ai checker',
    'deepfake verification','ai image verification','image authenticity verification',
    'detect midjourney','detect dall-e','stable diffusion detector',
    'ai face detector','deepfake face detector','fake image detector',
    'ai audio verification','voice clone verification','elevenlabs detector',
    'ai voice detector','deepfake audio','synthetic voice detector',
    'ai video verification','deepfake video detector','synthetic media verification',
    'aiscern','enterprise content authentication','ai trust and safety platform','digital content trust',
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
        <link rel="preconnect" href="https://clerk.aiscern.com" crossOrigin="anonymous" />
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
            <AnimationPreferenceProvider>
              <MotionProvider>
              {children}
              <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#171717',
                  border: '1px solid #262626',
                  color: '#fff',
                },
              }}
            />
              <CookieConsent />
              </MotionProvider>
            </AnimationPreferenceProvider>
          </AuthProvider>
        </ClerkClientProvider>
        <Analytics />
      </body>
    </html>
  )
}