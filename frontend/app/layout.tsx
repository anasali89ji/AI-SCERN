import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthProvider } from '@/components/auth-provider'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title:       'DETECTAI — AI Content Detection',
  description: 'Detect AI-generated text, images, audio, and video with enterprise-grade accuracy.',
  keywords:    ['AI detection', 'deepfake', 'AI text', 'content authenticity'],
  openGraph: {
    title:       'DETECTAI',
    description: 'AI content detection across text, images, audio and video',
    type:        'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary:       '#7c3aed',
          colorBackground:    '#0d0d1a',
          colorInputBackground:'#1a1a2e',
          colorText:          '#f1f5f9',
          colorInputText:     '#f1f5f9',
          colorNeutral:       '#64748b',
          borderRadius:       '0.75rem',
          fontFamily:         'Inter, sans-serif',
        },
        elements: {
          card:               'bg-surface border border-border shadow-2xl',
          headerTitle:        'text-text-primary font-black',
          headerSubtitle:     'text-text-muted',
          formButtonPrimary:  'btn-primary w-full',
          formFieldInput:     'input-field',
          footerActionLink:   'text-primary hover:text-primary/80',
          dividerLine:        'bg-border',
          dividerText:        'text-text-muted',
          socialButtonsBlockButton: 'btn-ghost border border-border',
          socialButtonsBlockButtonText: 'text-text-secondary',
        },
      }}
    >
      <html lang="en" className={inter.variable}>
        <body className="bg-background text-text-primary antialiased">
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
