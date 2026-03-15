import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
import './globals.css'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/components/auth-provider'

export const metadata: Metadata = {
  title: { default: 'DETECTAI — Unmask the Machine', template: '%s | DETECTAI' },
  description: 'Agentic AI content detection platform. Detect AI-generated images, videos, audio, and text with high accuracy using fine-tuned ML models.',
  keywords: ['AI detection', 'deepfake detection', 'AI content', 'fake media'],
  openGraph: {
    title: 'DETECTAI — Unmask the Machine',
    description: 'Detect AI-generated content with advanced ML models',
    url: 'https://detect-ai-nu.vercel.app',
    siteName: 'DETECTAI',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-background text-text-primary antialiased font-sans">
        <AuthProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: { background: '#111118', border: '1px solid #1E1E2E', color: '#F1F5F9' },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
