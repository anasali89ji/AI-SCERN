import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pricing',
          '/docs/',
          '/about',
          '/contact',
          '/reviews',
          '/detect/',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/dashboard',
          '/history',
          '/profile',
          '/settings',
          '/batch',
          '/scraper',
          '/pipeline',
          '/admin',
          '/api/',
          '/unauthorized',
        ],
      },
    ],
    sitemap: 'https://aiscern.com/sitemap.xml',
    host:    'https://aiscern.com',
  }
}
