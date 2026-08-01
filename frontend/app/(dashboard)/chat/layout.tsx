import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ARIA — AI Verification Assistant',
  description: 'Chat with ARIA, Aiscern\'s AI verification assistant. Ask about scan results, verification methods, AI content trends, and how to spot AI-generated media.',
  alternates: { canonical: 'https://aiscern.com/chat' },
  openGraph: {
    title: 'ARIA — AI Verification Assistant | Aiscern',
    description: 'Chat with ARIA to understand your verification results and learn about AI content identification.',
    url: 'https://aiscern.com/chat',
    images: [{ url: 'https://aiscern.com/api/og?title=ARIA+AI+Detection+Assistant&tool=Chat&color=%232563eb', width: 1200, height: 630 }],
  },
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
