import { MetadataRoute } from 'next'

const BASE = 'https://aiscern.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    // ── Marketing / Public ───────────────────────────────────────────────
    { url: BASE,                      lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/pricing`,         lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/docs/api`,        lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/about`,           lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/methodology`,     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/contact`,         lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`,         lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },

    { url: `${BASE}/reviews`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/blog`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },

    // ── Auth + Public ─────────────────────────────────────────────────────
    { url: `${BASE}/login`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${BASE}/signup`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.7 },

    // ── Detection Tools ──────────────────────────────────────────────────
    { url: `${BASE}/detect/image`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/detect/text`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/detect/audio`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/detect/video`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/batch`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },

    { url: `${BASE}/chat`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
  ]
}
