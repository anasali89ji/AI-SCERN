'use client'
/**
 * ClientSectionsLoader — thin client wrapper that lazy-loads ClientSections.
 * Must be 'use client' because next/dynamic with ssr:false is only valid
 * inside Client Components in Next.js 15 App Router.
 */
import dynamic from 'next/dynamic'

const ClientSections = dynamic(
  () => import('@/components/home/ClientSections'),
  {
    ssr: false,
    // Skeleton prevents CLS while JS loads — height matches all below-fold sections
    loading: () => <div className="min-h-[2000px]" aria-hidden="true" />,
  }
)

export default function ClientSectionsLoader() {
  return <ClientSections />
}
