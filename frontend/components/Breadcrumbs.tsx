'use client'

/**
 * components/Breadcrumbs.tsx
 *
 * Self-contained — reads its own path via usePathname(), no props needed
 * for the common case. Drop <Breadcrumbs /> under the nav on any page.
 *
 * Responsive: on mobile (<640px) with more than 2 segments, collapses the
 * middle into a "…" so long paths like /solutions/content-creators don't
 * wrap awkwardly or force the row to scroll — same pattern used for the
 * benchmarks table's mobile fallback elsewhere in this codebase (cards
 * instead of a cramped table). Full trail always shows at sm+ and is
 * always present in the JSON-LD regardless of what's visually collapsed,
 * so search engines still see the complete hierarchy.
 *
 * Segment labels default to a humanized version of the URL slug
 * ("content-creators" -> "Content Creators") and can be overridden via
 * LABEL_OVERRIDES for cases where that doesn't read naturally.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { Fragment } from 'react'

const LABEL_OVERRIDES: Record<string, string> = {
  hr: 'HR & Recruiting',
  api: 'API Reference',
  faq: 'FAQ',
  'content-creators': 'Content Creators',
  'how-it-works': 'How It Works',
}

// Acronyms that should stay uppercase when they appear as a whole word
// inside an auto-humanized slug (e.g. blog/[slug] posts titled
// "why-ai-detection-matters" -> "Why AI Detection Matters", not "Ai").
const ACRONYMS = new Set(['ai', 'api', 'seo', 'llm', 'gpt', 'faq', 'ip', 'ml'])

// Routes where a breadcrumb trail doesn't make sense — either a single
// top-level page with nothing above it but home, or a flow the user is
// mid-task in (auth, checkout-style pages) where a trail is just noise.
const SUPPRESSED_PREFIXES = ['/login', '/signup', '/maintenance', '/unauthorized', '/scan']

function humanize(segment: string): string {
  if (LABEL_OVERRIDES[segment]) return LABEL_OVERRIDES[segment]
  return segment
    .split('-')
    .map(w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbsProps {
  /** Override the auto-derived trail entirely — for dynamic routes like
   *  /guides/[slug] where the URL segment isn't a readable label and the
   *  real title only exists once the page has fetched its data. */
  items?: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname()

  if (SUPPRESSED_PREFIXES.some(p => pathname.startsWith(p))) return null

  const trail: BreadcrumbItem[] = items ?? (() => {
    const segments = pathname.split('/').filter(Boolean)
    let acc = ''
    return segments.map(seg => {
      acc += `/${seg}`
      return { label: humanize(seg), href: acc }
    })
  })()

  if (trail.length === 0) return null

  const full: BreadcrumbItem[] = [{ label: 'Home', href: '/' }, ...trail]

  // Mobile collapse: keep Home, "…", and the last 2 items when there's
  // enough depth that showing everything would wrap or crowd the row.
  const collapsedMobile = full.length > 3
    ? [full[0], null, ...full.slice(-2)]
    : full

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: full.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: `https://aiscern.com${item.href}`,
    })),
  }

  return (
    <nav aria-label="Breadcrumb" className={`w-full ${className}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Mobile — collapsed */}
      <ol className="sm:hidden flex items-center gap-1.5 text-xs text-text-muted overflow-hidden">
        {collapsedMobile.map((item, i) => {
          const isLast = i === collapsedMobile.length - 1
          if (item === null) {
            return (
              <Fragment key="ellipsis">
                <li className="text-text-disabled select-none">…</li>
                <li aria-hidden><ChevronRight className="w-3 h-3 text-text-disabled shrink-0" /></li>
              </Fragment>
            )
          }
          return (
            <Fragment key={item.href}>
              <li className="min-w-0">
                {isLast ? (
                  <span className="text-text-primary font-medium truncate block max-w-[140px]" aria-current="page">
                    {item.label}
                  </span>
                ) : item.href === '/' ? (
                  <Link href={item.href} className="flex items-center hover:text-text-primary transition-colors" aria-label="Home">
                    <Home className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <Link href={item.href} className="hover:text-text-primary transition-colors truncate block max-w-[100px]">
                    {item.label}
                  </Link>
                )}
              </li>
              {!isLast && <li aria-hidden><ChevronRight className="w-3 h-3 text-text-disabled shrink-0" /></li>}
            </Fragment>
          )
        })}
      </ol>

      {/* Desktop — full trail */}
      <ol className="hidden sm:flex items-center gap-1.5 text-[13px] text-text-muted flex-wrap">
        {full.map((item, i) => {
          const isLast = i === full.length - 1
          return (
            <Fragment key={item.href}>
              <li className="min-w-0">
                {isLast ? (
                  <span className="text-text-primary font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : item.href === '/' ? (
                  <Link href={item.href} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                    <Home className="w-3.5 h-3.5" /> Home
                  </Link>
                ) : (
                  <Link href={item.href} className="hover:text-text-primary transition-colors">
                    {item.label}
                  </Link>
                )}
              </li>
              {!isLast && <li aria-hidden><ChevronRight className="w-3.5 h-3.5 text-text-disabled shrink-0" /></li>}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
