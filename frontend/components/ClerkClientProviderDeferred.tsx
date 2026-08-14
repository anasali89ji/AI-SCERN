'use client'

import dynamic from 'next/dynamic'

/**
 * `ssr: false` inside next/dynamic() is only allowed in a Client Component —
 * app/layout.tsx is a Server Component (it exports `metadata`), so the
 * dynamic() call has to live here instead. This wrapper is the only thing
 * layout.tsx imports; everything else about the deferral is unchanged.
 */
const ClerkClientProvider = dynamic(
  () => import('@/components/ClerkClientProvider').then((m) => m.ClerkClientProvider),
  { ssr: false }
)

export { ClerkClientProvider }
