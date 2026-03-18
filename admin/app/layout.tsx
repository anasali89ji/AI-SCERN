import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Aiscern Admin — Owner Panel',
  description: 'Aiscern admin dashboard — restricted access',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.className}`}>
      <head>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="theme-color" content="#0a0a14" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
