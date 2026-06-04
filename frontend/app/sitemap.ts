import { MetadataRoute } from 'next'

const BASE = 'https://aiscern.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    // ── Marketing / Public ───────────────────────────────────────────────
    { url: BASE,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/pricing`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/methodology`,             lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/benchmarks`,              lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research`,                lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/transparency`,            lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/compare`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/enterprise`,              lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/partners`,                lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/status`,                  lastModified: now, changeFrequency: 'daily',   priority: 0.5 },
    { url: `${BASE}/roadmap`,                 lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/faq`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/changelog`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${BASE}/security`,                lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE}/contact`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,                   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/reviews`,                 lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/blog`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/docs/api`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },

    // ── Solutions Hub & Industry Pages ───────────────────────────────────
    { url: `${BASE}/solutions`,                         lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/education`,               lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/hr`,                      lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/media`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/legal`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/security`,                lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/healthcare`,              lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/marketing`,               lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/research`,                lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/solutions/content-creators`,        lastModified: now, changeFrequency: 'monthly', priority: 0.8 },

    // ── Auth ─────────────────────────────────────────────────────────────
    { url: `${BASE}/login`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${BASE}/signup`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.7 },

    // ── Detection Tools (public-facing, high priority for SEO) ───────────
    { url: `${BASE}/detect/image`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/detect/text`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/detect/audio`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/detect/video`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },

    // ── ARIA Assistant ────────────────────────────────────────────────────
    { url: `${BASE}/chat`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
  ]
}
