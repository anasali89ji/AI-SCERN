/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://aiscern.com',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/dashboard', '/profile', '/settings', '/history', '/pipeline', '/scraper', '/admin'] },
    ],
  },
  exclude: ['/admin/*', '/settings', '/profile', '/dashboard', '/history', '/pipeline', '/scraper', '/batch', '/chat'],
  additionalPaths: async () => [
    { loc: '/detect/text',  changefreq: 'weekly',  priority: 0.9 },
    { loc: '/detect/image', changefreq: 'weekly',  priority: 0.9 },
    { loc: '/detect/audio', changefreq: 'weekly',  priority: 0.8 },
    { loc: '/detect/video', changefreq: 'weekly',  priority: 0.8 },
    { loc: '/blog',         changefreq: 'weekly',  priority: 0.8 },
    { loc: '/blog/how-to-detect-ai-generated-text-2026', changefreq: 'monthly', priority: 0.7 },
    { loc: '/blog/what-is-a-deepfake',                   changefreq: 'monthly', priority: 0.7 },
    { loc: '/blog/aiscern-vs-gptzero-vs-turnitin',       changefreq: 'monthly', priority: 0.7 },
    { loc: '/about',        changefreq: 'monthly', priority: 0.7 },
    { loc: '/pricing',      changefreq: 'monthly', priority: 0.8 },
    { loc: '/reviews',      changefreq: 'weekly',  priority: 0.7 },
    { loc: '/contact',      changefreq: 'monthly', priority: 0.6 },
    { loc: '/docs/api',     changefreq: 'monthly', priority: 0.8 },
    { loc: '/security',     changefreq: 'monthly', priority: 0.6 },
    { loc: '/privacy',      changefreq: 'monthly', priority: 0.5 },
    { loc: '/terms',        changefreq: 'monthly', priority: 0.5 },
  ],
}
