import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/docs', '/about', '/contact', '/detect/', '/login', '/signup'],
        disallow: ['/dashboard', '/history', '/profile', '/settings', '/batch', '/api/'],
      },
    ],
    sitemap: 'https://detect-ai-nu.vercel.app/sitemap.xml',
    host: 'https://detect-ai-nu.vercel.app',
  }
}
