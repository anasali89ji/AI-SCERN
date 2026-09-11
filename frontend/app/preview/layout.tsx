import type { Metadata } from 'next'

/**
 * /preview/* is a design-preview surface (the alternate "new-home" layout),
 * not a public product page. Keep it out of search indexes and away from
 * canonical-link confusion — the real homepage owns aiscern.com.
 */
export const metadata: Metadata = {
  title: 'Design Preview — Aiscern',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
