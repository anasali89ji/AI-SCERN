import { MetadataRoute } from 'next'

/**
 * robots.ts — Security fix: do NOT list auth-protected paths in Disallow.
 * Auth-only pages (/dashboard, /admin, etc.) already redirect unauthenticated
 * users to /login, so Google can never index them. Advertising these paths
 * via robots.txt only helps attackers enumerate targets (Security Report §2.2).
 *
 * Only /api/ is explicitly disallowed (API routes should never be crawled).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/detect/',
          '/pricing',
          '/enterprise',
          '/compare',
          '/solutions/',
          '/blog',
          '/docs/',
          '/guides',
          '/methodology',
          '/benchmarks',
          '/how-it-works',
          '/research',
          '/transparency',
          '/reviews',
          '/about',
          '/partners',
          '/contact',
          '/faq',
          '/security',
          '/changelog',
          '/roadmap',
          '/status',
          '/chat',
          '/login',
          '/signup',
          '/privacy',
          '/terms',
          '/dpa',
          '/accessibility',
        ],
        // Only block API crawling — do NOT list private paths here
        disallow: ['/api/'],
      },
    ],
    sitemap: 'https://aiscern.com/sitemap.xml',
    host: 'https://aiscern.com',
  }
}
