import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aiscern Admin',
  description: 'Aiscern Admin Console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
