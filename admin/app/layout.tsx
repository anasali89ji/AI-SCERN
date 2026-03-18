import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aiscern Admin — Owner Panel',
  description: 'Aiscern admin dashboard — restricted access',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
